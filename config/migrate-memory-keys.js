const path = require('path');
const mongoose = require('mongoose');
const { createModels, logger } = require('@librechat/data-schemas');

require('module-alias')({ base: path.resolve(__dirname, '..', 'api') });
const connect = require('./connect');

function parseArgs(argv = process.argv.slice(2)) {
  const options = { dryRun: true };

  argv.forEach((arg) => {
    if (arg === '--apply' || arg === '--no-dry-run') {
      options.dryRun = false;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg.startsWith('--batch-size=')) {
      const value = Number.parseInt(arg.split('=')[1], 10);
      if (!Number.isNaN(value) && value > 0) {
        options.batchSize = value;
      }
    }
  });

  return options;
}

async function migrateMemoryKeys({ dryRun = true } = {}) {
  await connect();

  const models = createModels(mongoose);
  const MemoryEntry = models.MemoryEntry;

  logger.info(`Starting memory key migration${dryRun ? ' (dry run)' : ''}`);

  const allKeys = await MemoryEntry.find({}, { userId: 1, key: 1 }).lean().exec();
  const keysByUser = new Map();

  for (const entry of allKeys) {
    const userKey = entry.userId.toString();
    if (!keysByUser.has(userKey)) {
      keysByUser.set(userKey, new Set());
    }
    keysByUser.get(userKey).add(entry.key);
  }

  const duplicates = await MemoryEntry.aggregate([
    {
      $group: {
        _id: { userId: '$userId', key: '$key' },
        ids: { $push: '$_id' },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ]).exec();

  if (duplicates.length === 0) {
    logger.info('No duplicate memory keys found.');
    if (!dryRun) {
      await MemoryEntry.syncIndexes();
    }
    return { dryRun, duplicates: 0, renamed: 0 };
  }

  logger.info(`Found ${duplicates.length} duplicate key group(s) to process.`);

  let renamed = 0;

  for (const group of duplicates) {
    const { userId, key } = group._id;
    const userKey = userId.toString();
    const existingKeys = keysByUser.get(userKey) || new Set();
    if (!keysByUser.has(userKey)) {
      keysByUser.set(userKey, existingKeys);
    }
    const ids = group.ids.map((id) => id.toString());

    const docs = await MemoryEntry.find({ _id: { $in: ids } })
      .sort({ updated_at: 1, _id: 1 })
      .exec();

    if (docs.length <= 1) {
      continue;
    }

    logger.warn(
      `User ${userKey} has ${docs.length} memories with duplicate key "${key}". Keeping the oldest and renaming the rest.`,
    );

    const duplicatesToRename = docs.slice(1);
    let suffix = 1;

    for (const doc of duplicatesToRename) {
      let newKey;
      do {
        newKey = `${key}-${suffix++}`;
      } while (existingKeys.has(newKey));

      if (dryRun) {
        logger.info(
          `[Dry Run] Would rename memory ${doc._id.toString()} for user ${userKey} from "${key}" to "${newKey}"`,
        );
      } else {
        await MemoryEntry.updateOne(
          { _id: doc._id },
          {
            $set: {
              key: newKey,
            },
          },
        ).exec();
        logger.info(
          `Renamed memory ${doc._id.toString()} for user ${userKey} from "${key}" to "${newKey}"`,
        );
      }

      existingKeys.add(newKey);
      renamed += 1;
    }
  }

  if (!dryRun) {
    await MemoryEntry.syncIndexes();
  }

  logger.info(
    `Memory key migration complete. Duplicate groups processed: ${duplicates.length}. Memories renamed: ${renamed}.`,
  );

  return { dryRun, duplicates: duplicates.length, renamed };
}

module.exports = migrateMemoryKeys;

if (require.main === module) {
  const options = parseArgs();

  migrateMemoryKeys(options)
    .then((result) => {
      logger.info(`Migration finished${result.dryRun ? ' (dry run)' : ''}.`);
    })
    .catch((error) => {
      logger.error('Memory key migration failed', error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect().catch((error) => {
        logger.error('Failed to disconnect mongoose after migration', error);
      });
    });
}

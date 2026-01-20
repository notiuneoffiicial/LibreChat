import { useCallback, useRef } from 'react';
import { useRecoilState } from 'recoil';
import store from '~/store';
import type { BehaviorSignal } from '~/common/DecisionSession.types';

export function useBehaviorSignals() {
    const [signals, setSignals] = useRecoilState(store.behaviorSignalsAtom);
    const startTimeRef = useRef<number | null>(null);

    const startTracking = useCallback(() => {
        startTimeRef.current = Date.now();
    }, []);

    const analyzeInput = useCallback((input: string): BehaviorSignal[] => {
        if (!startTimeRef.current) return [];

        const now = Date.now();
        const duration = now - startTimeRef.current;
        const newSignals: BehaviorSignal[] = [];

        // 1. Response Time
        // Fast (< 3s) = Clarity? Or Impulsiveness?
        // Moderate (5-20s) = Thoughtful
        // Slow (> 20s) = Struggle?
        // This needs calibration, but let's assume very long pauses = confusion
        let timeValue = 0.5;
        let timeIndicates: 'clarity' | 'confusion' = 'clarity';

        if (duration > 20000 && input.length < 50) {
            // Long pause, short answer -> Confusion/Stuck
            timeValue = 0.8;
            timeIndicates = 'confusion';
        } else if (duration < 3000) {
            // Very fast -> Clarity (or gut reaction)
            timeValue = 0.9;
            timeIndicates = 'clarity';
        }

        newSignals.push({
            type: 'response_time',
            value: timeValue,
            timestamp: now,
            indicates: timeIndicates
        });

        // 2. Hedging
        const hedgingRegex = /\b(maybe|might|could|guess|probably|unsure|don't know|not sure|assume)\b/i;
        if (hedgingRegex.test(input)) {
            newSignals.push({
                type: 'hedging',
                value: 0.8,
                timestamp: now,
                indicates: 'confusion'
            });
        }

        // 3. Length (Complexity)
        if (input.length > 200) {
            newSignals.push({
                type: 'response_length',
                value: Math.min(1, input.length / 500),
                timestamp: now,
                indicates: 'clarity' // Detailed answer usually means they know
            });
        }

        // Update atom
        setSignals(prev => [...prev, ...newSignals]);

        // Reset timer
        startTimeRef.current = null;

        return newSignals;
    }, [setSignals]);

    return {
        startTracking,
        analyzeInput
    };
}

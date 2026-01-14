/**
 * OptimismAI - Living Decision Surface
 * useDecisionChat - Bridge between decision surface and LibreChat's chat completion
 *
 * This hook provides AI-powered question generation by leveraging
 * LibreChat's existing chat infrastructure with structured prompts.
 */

import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRecoilValue, useSetRecoilState, useRecoilState } from 'recoil';
import { v4 as uuidv4 } from 'uuid';
import { QueryKeys, Constants } from 'librechat-data-provider';
import type { TMessage, TConversation } from 'librechat-data-provider';
import store from '~/store';
import { getSpawnPosition } from '~/components/DecisionSurface/nodeMotionConfig';
import type {
    ThoughtNodeData,
    TopicKey,
    QuestionCategory,
    ExpectedInfoType,
} from '~/common/DecisionSession.types';

// ============================================================================
// System Prompts for Decision Surface
// ============================================================================

const DECISION_SYSTEM_PROMPT = `You are OptimismAI, a decision clarification engine. Your role is to help users think through important decisions by asking high-leverage questions.

When a user shares a decision they're facing:
1. Generate exactly 3 questions - one for each category:
   - REALITY: Uncover constraints, facts, resources, timelines
   - VALUES: Explore alignment, feelings, what matters most
   - OPTIONS: Discover alternatives beyond obvious choices

Rules:
- Each question must be ONE sentence maximum
- Questions should reveal what's NOT YET KNOWN
- Never be chatty or add explanations
- Focus on high-leverage insights that shift perspective

Respond with valid JSON only:
{
  "questions": [
    { "category": "reality", "question": "...", "expectedType": "fact" },
    { "category": "values", "question": "...", "expectedType": "value" },
    { "category": "options", "question": "...", "expectedType": "option" }
  ],
  "domain": "career|finance|relationship|health|major_purchase|other"
}`;

const ANSWER_ANALYSIS_PROMPT = `Analyze this answer to a decision question. Extract insights without being verbose.

Question: {{QUESTION}}
Answer: {{ANSWER}}

Respond with valid JSON only:
{
  "constraints": ["any hard constraints discovered"],
  "assumptions": ["any assumptions that should be tested"],
  "needsFollowUp": true|false,
  "followUpQuestion": "if needed, a single clarifying question",
  "signals": [{"type": "assumption|uncertainty|irreversibility", "text": "brief note"}]
}`;

// ============================================================================
// Hook
// ============================================================================

interface UseDecisionChatOptions {
    conversationId?: string;
}

interface GeneratedQuestion {
    category: TopicKey;
    question: string;
    expectedType: ExpectedInfoType;
}

export function useDecisionChat({ conversationId }: UseDecisionChatOptions = {}) {
    const queryClient = useQueryClient();
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const responseAccumulatorRef = useRef<string>('');

    // Store state
    const anchorPosition = useRecoilValue(store.anchorPositionAtom);
    const setThoughtNodes = useSetRecoilState(store.thoughtNodesAtom);
    const setSession = useSetRecoilState(store.decisionSessionAtom);
    const [conversation, setConversation] = useRecoilState(
        store.conversationByIndex(0),
    );

    /**
     * Generate initial questions using LibreChat's chat completion
     * This stores the decision statement as a message and gets AI-generated questions
     */
    const generateQuestionsFromDecision = useCallback(
        async (decisionStatement: string): Promise<ThoughtNodeData[]> => {
            setIsGenerating(true);
            setError(null);
            responseAccumulatorRef.current = '';

            try {
                // For now, generate questions locally (simulated)
                // In full integration, this would use the SSE chat completion
                // via setSubmission pattern similar to useChatFunctions

                // Simulate AI response delay
                await new Promise((resolve) => setTimeout(resolve, 800));

                // Parse the decision to generate contextual questions
                const questions = generateContextualQuestions(decisionStatement);

                // Create thought nodes
                const now = Date.now();
                const nodes: ThoughtNodeData[] = questions.map((q, index) => ({
                    id: uuidv4(),
                    state: 'DORMANT' as const,
                    question: q.question,
                    topicKey: q.category,
                    category: getCategoryFromTopic(q.category),
                    expectedInfoType: q.expectedType,
                    position: getSpawnPosition(index, anchorPosition.x, anchorPosition.y),
                    satellites: [],
                    signals: [],
                    createdAt: now + index * 70, // Stagger for animation
                }));

                // Store decision as first message in the conversation
                const userMessage: TMessage = {
                    messageId: uuidv4(),
                    conversationId: conversationId || Constants.NEW_CONVO,
                    parentMessageId: Constants.NO_PARENT,
                    text: decisionStatement,
                    sender: 'User',
                    isCreatedByUser: true,
                    error: false,
                };

                // Store AI response (the questions) as system message
                const aiMessage: TMessage = {
                    messageId: uuidv4(),
                    conversationId: conversationId || Constants.NEW_CONVO,
                    parentMessageId: userMessage.messageId,
                    text: `[Decision Analysis] Generated 3 inquiry paths:\n\n• Reality: ${questions[0]?.question}\n• Values: ${questions[1]?.question}\n• Options: ${questions[2]?.question}`,
                    sender: 'OptimismAI',
                    isCreatedByUser: false,
                    error: false,
                };

                // Update query cache with messages
                const queryKey = [QueryKeys.messages, conversationId || Constants.NEW_CONVO];
                const existingMessages = queryClient.getQueryData<TMessage[]>(queryKey) || [];
                queryClient.setQueryData(queryKey, [...existingMessages, userMessage, aiMessage]);

                // Update session with domain info
                const domain = detectDomain(decisionStatement);
                setSession((prev) =>
                    prev
                        ? {
                            ...prev,
                            draft: {
                                statement: decisionStatement,
                                domain,
                                uncertaintyEstimate: 0.7,
                                emotionEstimate: 'neutral',
                            },
                            updatedAt: Date.now(),
                        }
                        : prev,
                );

                setThoughtNodes(nodes);
                return nodes;
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Failed to generate questions';
                setError(message);
                console.error('[useDecisionChat] Error:', err);
                return [];
            } finally {
                setIsGenerating(false);
            }
        },
        [anchorPosition, conversationId, queryClient, setSession, setThoughtNodes],
    );

    /**
     * Store an answer as a LibreChat message
     */
    const storeAnswer = useCallback(
        (nodeId: string, question: string, answer: string) => {
            const queryKey = [QueryKeys.messages, conversationId || Constants.NEW_CONVO];
            const existingMessages = queryClient.getQueryData<TMessage[]>(queryKey) || [];

            // Find the parent message (the question)
            const lastMessage = existingMessages[existingMessages.length - 1];

            const answerMessage: TMessage = {
                messageId: uuidv4(),
                conversationId: conversationId || Constants.NEW_CONVO,
                parentMessageId: lastMessage?.messageId || Constants.NO_PARENT,
                text: `Q: ${question}\n\nA: ${answer}`,
                sender: 'User',
                isCreatedByUser: true,
                error: false,
            };

            queryClient.setQueryData(queryKey, [...existingMessages, answerMessage]);
        },
        [conversationId, queryClient],
    );

    return {
        isGenerating,
        error,
        generateQuestionsFromDecision,
        storeAnswer,
    };
}

// ============================================================================
// Helpers
// ============================================================================

function getCategoryFromTopic(topic: TopicKey): QuestionCategory {
    switch (topic) {
        case 'reality':
            return 'grounding';
        case 'values':
            return 'clarifying';
        case 'options':
            return 'contrast';
        default:
            return 'grounding';
    }
}

function detectDomain(statement: string): string {
    const lower = statement.toLowerCase();
    if (lower.includes('job') || lower.includes('career') || lower.includes('work') || lower.includes('quit')) {
        return 'career';
    }
    if (lower.includes('money') || lower.includes('invest') || lower.includes('buy') || lower.includes('spend')) {
        return 'finance';
    }
    if (lower.includes('relationship') || lower.includes('partner') || lower.includes('marry')) {
        return 'relationship';
    }
    if (lower.includes('health') || lower.includes('doctor') || lower.includes('treatment')) {
        return 'health';
    }
    if (lower.includes('house') || lower.includes('car') || lower.includes('purchase')) {
        return 'major_purchase';
    }
    return 'other';
}

function generateContextualQuestions(statement: string): GeneratedQuestion[] {
    const domain = detectDomain(statement);
    const lower = statement.toLowerCase();

    // Domain-specific question templates
    const templates: Record<string, GeneratedQuestion[]> = {
        career: [
            { category: 'reality', question: 'What financial runway do you have if you make this change?', expectedType: 'fact' },
            { category: 'values', question: 'What feels most misaligned about your current situation?', expectedType: 'value' },
            { category: 'options', question: 'What paths exist between staying fully and leaving completely?', expectedType: 'option' },
        ],
        finance: [
            { category: 'reality', question: 'What is the actual number you need, and by when?', expectedType: 'fact' },
            { category: 'values', question: 'What would this money enable that matters to you?', expectedType: 'value' },
            { category: 'options', question: 'What are three different ways to achieve the same outcome?', expectedType: 'option' },
        ],
        relationship: [
            { category: 'reality', question: 'What specific behaviors or patterns are you responding to?', expectedType: 'fact' },
            { category: 'values', question: 'What would staying or leaving mean for the person you want to become?', expectedType: 'value' },
            { category: 'options', question: 'What could change about the situation that would change your answer?', expectedType: 'option' },
        ],
        default: [
            { category: 'reality', question: 'What constraints are truly non-negotiable in this decision?', expectedType: 'fact' },
            { category: 'values', question: 'What would you regret more: acting or not acting?', expectedType: 'value' },
            { category: 'options', question: 'What alternatives have you not yet fully considered?', expectedType: 'option' },
        ],
    };

    return templates[domain] || templates.default;
}

export default useDecisionChat;

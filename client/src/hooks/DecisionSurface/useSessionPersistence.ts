/**
 * OptimismAI - Session Persistence Hook
 * Manages backend persistence for decision sessions with auto-save
 */

import { useCallback, useEffect, useRef } from 'react';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as dataService from 'librechat-data-provider';
import store from '~/store';
import type { DecisionSession, ThoughtNodeData, Milestone, LeaningVector, SessionPhase } from '~/common/DecisionSession.types';

const AUTO_SAVE_DELAY = 2000; // 2 seconds debounce

/**
 * Hook for managing session persistence with backend API
 */
export function useSessionPersistence() {
    const queryClient = useQueryClient();
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Session state
    const session = useRecoilValue(store.decisionSessionAtom);
    const nodes = useRecoilValue(store.thoughtNodesAtom);
    const milestones = useRecoilValue(store.milestonesAtom);
    const leaning = useRecoilValue(store.leaningVectorAtom);
    const phase = useRecoilValue(store.sessionPhaseAtom);

    // Session history state
    const [sessionHistory, setSessionHistory] = useRecoilState(store.sessionHistoryAtom);
    const [activeSessionId, setActiveSessionId] = useRecoilState(store.activeSessionIdAtom);
    const setSessionHistoryOpen = useSetRecoilState(store.sessionHistoryOpenAtom);
    const setSaveStatus = useSetRecoilState(store.sessionSaveStatusAtom);

    // Session setters
    const setSession = useSetRecoilState(store.decisionSessionAtom);
    const setNodes = useSetRecoilState(store.thoughtNodesAtom);
    const setMilestones = useSetRecoilState(store.milestonesAtom);
    const setLeaning = useSetRecoilState(store.leaningVectorAtom);
    const setPhase = useSetRecoilState(store.sessionPhaseAtom);
    const setComposerVisible = useSetRecoilState(store.composerVisibleAtom);
    const setComposerSubmitted = useSetRecoilState(store.composerSubmittedAtom);
    const setFieldSettling = useSetRecoilState(store.fieldSettlingAtom);
    const setSessionEndingState = useSetRecoilState(store.sessionEndingStateAtom);

    // Fetch session history
    const {
        data: historyData,
        isLoading: isLoadingHistory,
        refetch: refetchHistory,
    } = useQuery({
        queryKey: ['decisionSessions'],
        queryFn: () => dataService.getDecisionSessions({ limit: 50, order: 'desc' }),
        staleTime: 30000, // 30 seconds
    });

    // Update local state when history is fetched
    useEffect(() => {
        if (historyData?.sessions) {
            setSessionHistory(historyData.sessions.map(s => ({
                sessionId: s.sessionId,
                title: s.title,
                statement: s.statement,
                phase: s.phase as SessionPhase,
                endingState: s.endingState as 'clarity' | 'conditional_clarity' | 'rest' | undefined,
                createdAt: s.createdAt,
                updatedAt: s.updatedAt,
            })));
        }
    }, [historyData, setSessionHistory]);

    // Save session mutation
    const saveMutation = useMutation({
        mutationFn: async (data: dataService.DecisionSessionData) => {
            if (!data.sessionId) throw new Error('sessionId required');
            // Check if session exists first
            try {
                await dataService.getDecisionSessionById(data.sessionId);
                return dataService.updateDecisionSession(data.sessionId, data);
            } catch {
                return dataService.createDecisionSession(data);
            }
        },
        onSuccess: () => {
            setSaveStatus('saved');
            refetchHistory();
            setTimeout(() => setSaveStatus('idle'), 2000);
        },
        onError: () => {
            setSaveStatus('error');
            setTimeout(() => setSaveStatus('idle'), 3000);
        },
    });

    // Delete session mutation
    const deleteMutation = useMutation({
        mutationFn: (sessionId: string) => dataService.deleteDecisionSession(sessionId),
        onSuccess: () => {
            refetchHistory();
        },
    });

    /**
     * Save current session to backend
     */
    const saveSession = useCallback(async () => {
        if (!session?.id) return;

        setSaveStatus('saving');

        const sessionData: dataService.DecisionSessionData = {
            sessionId: session.id,
            title: session.draft?.statement?.slice(0, 50) || 'New Decision',
            statement: session.draft?.statement,
            phase: phase,
            endingState: session.endingState,
            nodes: nodes,
            milestones: milestones,
            leaning: leaning,
            constraints: session.constraints,
            assumptions: session.assumptions,
            options: session.options,
            insights: session.insights,
        };

        try {
            await saveMutation.mutateAsync(sessionData);
            setActiveSessionId(session.id);
        } catch (error) {
            console.error('[useSessionPersistence] Save failed:', error);
        }
    }, [session, nodes, milestones, leaning, phase, saveMutation, setSaveStatus, setActiveSessionId]);

    /**
     * Auto-save with debounce when session state changes
     */
    useEffect(() => {
        // Only auto-save if we have an active session with content
        if (!session?.id || phase === 'IDLE') return;

        // Clear existing timeout
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        // Set new timeout for auto-save
        saveTimeoutRef.current = setTimeout(() => {
            saveSession();
        }, AUTO_SAVE_DELAY);

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [session, nodes, milestones, leaning, phase, saveSession]);

    /**
     * Load a session from backend
     */
    const loadSession = useCallback(async (sessionId: string) => {
        try {
            // Save current session first if there is one
            if (session?.id && phase !== 'IDLE') {
                await saveSession();
            }

            const data = await dataService.getDecisionSessionById(sessionId);

            // Restore session state
            const restoredSession: DecisionSession = {
                id: data.sessionId,
                conversationId: `decision-${data.sessionId}`,
                phase: (data.phase || 'IDLE') as SessionPhase,
                createdAt: new Date(data.createdAt || Date.now()).getTime(),
                updatedAt: new Date(data.updatedAt || Date.now()).getTime(),
                draft: data.statement ? {
                    statement: data.statement,
                    domain: 'general',
                    uncertaintyEstimate: 0.5,
                    emotionEstimate: 'neutral',
                } : undefined,
                constraints: data.constraints || [],
                assumptions: (data.assumptions || []) as DecisionSession['assumptions'],
                options: (data.options || []) as DecisionSession['options'],
                insights: data.insights || [],
                milestones: (data.milestones || []) as Milestone[],
                endingState: data.endingState as DecisionSession['endingState'],
            };

            setSession(restoredSession);
            setPhase((data.phase || 'IDLE') as SessionPhase);
            setNodes((data.nodes || []) as ThoughtNodeData[]);
            setMilestones((data.milestones || []) as Milestone[]);
            setLeaning(data.leaning as LeaningVector | null);
            setActiveSessionId(data.sessionId);

            // Set composer visibility based on phase
            const hasSubmitted = data.phase !== 'IDLE' && data.statement;
            setComposerVisible(!!hasSubmitted);
            setComposerSubmitted(!!hasSubmitted);

            // Close history panel
            setSessionHistoryOpen(false);

            console.log('[useSessionPersistence] Session loaded:', sessionId);
        } catch (error) {
            console.error('[useSessionPersistence] Load failed:', error);
        }
    }, [session, phase, saveSession, setSession, setPhase, setNodes, setMilestones, setLeaning, setActiveSessionId, setComposerVisible, setComposerSubmitted, setSessionHistoryOpen]);

    /**
     * Start a new session (saves current first)
     */
    const startNewSession = useCallback(async () => {
        try {
            // Save current session if exists
            if (session?.id && phase !== 'IDLE') {
                await saveSession();
            }

            // Reset all session state
            setSession(null);
            setPhase('IDLE');
            setNodes([]);
            setMilestones([]);
            setLeaning(null);
            setActiveSessionId(null);
            setComposerVisible(false);
            setComposerSubmitted(false);
            setFieldSettling(false);
            setSessionEndingState(null);

            // Close history panel
            setSessionHistoryOpen(false);

            console.log('[useSessionPersistence] Started new session');
        } catch (error) {
            console.error('[useSessionPersistence] Start new session failed:', error);
        }
    }, [session, phase, saveSession, setSession, setPhase, setNodes, setMilestones, setLeaning, setActiveSessionId, setComposerVisible, setComposerSubmitted, setFieldSettling, setSessionEndingState, setSessionHistoryOpen]);

    /**
     * Delete a session
     */
    const deleteSession = useCallback(async (sessionId: string) => {
        try {
            await deleteMutation.mutateAsync(sessionId);

            // If deleting the active session, reset state
            if (sessionId === activeSessionId) {
                await startNewSession();
            }

            console.log('[useSessionPersistence] Session deleted:', sessionId);
        } catch (error) {
            console.error('[useSessionPersistence] Delete failed:', error);
        }
    }, [deleteMutation, activeSessionId, startNewSession]);

    return {
        // State
        sessionHistory,
        activeSessionId,
        isLoadingHistory,
        isSaving: saveMutation.isPending,

        // Actions
        saveSession,
        loadSession,
        startNewSession,
        deleteSession,
        refetchHistory,
    };
}

export default useSessionPersistence;

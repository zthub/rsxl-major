import React, { useEffect, useRef } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useAuth } from './authContext';
import { dbService } from './dbService';

interface GameSessionTrackerProps {
    children: React.ReactNode;
}

export const GameSessionTracker: React.FC<GameSessionTrackerProps> = ({ children }) => {
    const { session } = useAuth();
    const location = useLocation();
    const { gameId } = useParams();

    // Use a ref to store the start time so it persists across re-renders
    // without triggering new effect executions
    const startTimeRef = useRef<number>(Date.now());

    // Update the ref whenever the location (which game they are on) changes
    useEffect(() => {
        startTimeRef.current = Date.now();

        return () => {
            // This cleanup runs when the component UNMOUNTS
            // i.e., when they leave the /module/:moduleId/game/:gameId route

            const endTime = Date.now();
            const durationSeconds = Math.floor((endTime - startTimeRef.current) / 1000);

            // Only record sessions that lasted longer than 10 seconds 
            // to avoid tracking accidental clicks / fast bounces.
            // Also ensure we have a logged-in session.
            if (durationSeconds > 10 && session?.user) {
                // We use a "fire and forget" async call here because we can't await inside a cleanup function easily.
                // For gameId, if it's missing from params during unmount (sometimes happens in react-router v6),
                // we can attempt to extract it from the path, or fallback to 'unknown-game'
                const pathParts = location.pathname.split('/');
                const fallbackGameId = pathParts[4] || 'unknown-game'; // /module/:id/game/:gameId
                const finalGameId = gameId || fallbackGameId;

                dbService.saveTrainingSession({
                    game_id: finalGameId,
                    score: 0, // Default score, as they didn't explicitly finish via endGame
                    duration_seconds: durationSeconds,
                    acuity_settings: JSON.stringify({ exitType: 'navigated_away' })
                }).catch(err => {
                    console.error("Failed to silently save session on unmount", err);
                });
            }
        };
    }, [location.pathname, session?.user, gameId]);

    return <>{children}</>;
};

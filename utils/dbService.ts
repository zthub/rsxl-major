import { supabase } from './supabase';

export interface TrainingSessionData {
    id?: string;
    game_id: string;
    score: number;
    duration_seconds: number;
    acuity_settings?: string | null;
    completed_at?: string;
}

export const dbService = {
    /**
     * Save a completed training session to the database
     */
    async saveTrainingSession(data: TrainingSessionData): Promise<{ success: boolean; error?: any }> {
        try {
            // 1. Get the current logged-in user
            const { data: { session } } = await supabase.auth.getSession();

            if (!session?.user) {
                console.warn('Cannot save session: No user logged in. Falling back to local storage only.');
                // Here you could potentially fallback to local storage if desired
                return { success: false, error: 'User not authenticated' };
            }

            // 2. Insert into the training_sessions table
            // The user_id is automatically enforced by RLS, but we still need to provide it 
            // based on our schema definition (not null).
            const { error } = await supabase
                .from('training_sessions')
                .insert([
                    {
                        user_id: session.user.id,
                        game_id: data.game_id,
                        score: data.score,
                        duration_seconds: data.duration_seconds,
                        acuity_settings: data.acuity_settings,
                        // completed_at is handled by the database default
                    }
                ]);

            if (error) throw error;

            console.log('Successfully saved training session to cloud.');
            return { success: true };
        } catch (error: any) {
            console.error('Failed to save training session:', error.message);
            return { success: false, error: error.message };
        }
    },

    /**
     * Fetch the user's training history
     */
    async getMyTrainingHistory() {
        try {
            // RLS ensures they ONLY get their own data, even if we just select *
            const { data, error } = await supabase
                .from('training_sessions')
                .select('*')
                .order('completed_at', { ascending: false });

            if (error) throw error;
            return { data, error: null };
        } catch (error: any) {
            console.error('Failed to fetch history:', error.message);
            return { data: null, error: error.message };
        }
    },

    /**
     * Fetch and aggregate daily statistics
     * Groups sessions that occur within 30 minutes of each other into a single "played time"
     */
    async getDailyStatistics() {
        try {
            // 1. Fetch all records for the user (RLS protected), ordered by oldest first
            const { data, error } = await supabase
                .from('training_sessions')
                .select('*')
                .order('completed_at', { ascending: true }); // Oldest first is easier for chronological grouping

            if (error) throw error;
            if (!data || data.length === 0) return { data: [], error: null };

            // 2. Aggregate data by day
            const dailyStats: Record<string, { date: string; totalDuration: number; sessionCount: number; lastSessionEnd: number }> = {};
            const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

            data.forEach((record) => {
                // Ensure date string is valid
                if (!record.completed_at) return;

                const recordEndAt = new Date(record.completed_at).getTime();
                // We estimate the start time by subtracting the duration
                const recordStartAt = recordEndAt - (record.duration_seconds * 1000);

                // Get local calendar day string (e.g., "3/11/2026")
                const dayKey = new Date(recordEndAt).toLocaleDateString();

                if (!dailyStats[dayKey]) {
                    // First record of the day
                    dailyStats[dayKey] = {
                        date: dayKey,
                        totalDuration: record.duration_seconds,
                        sessionCount: 1,
                        lastSessionEnd: recordEndAt
                    };
                } else {
                    const stats = dailyStats[dayKey];
                    stats.totalDuration += record.duration_seconds;

                    // Check if this record is a continuation of the previous session, or a new session entirely
                    // If the time between the start of THIS record and the end of the LAST record is > 30 mins
                    if ((recordStartAt - stats.lastSessionEnd) > SESSION_TIMEOUT_MS) {
                        stats.sessionCount += 1; // It's a new session
                    }

                    // Update the last known end time for the next iteration
                    stats.lastSessionEnd = Math.max(stats.lastSessionEnd, recordEndAt);
                }
            });

            // Convert map back to array and sort newest first for display
            const aggregatedArray = Object.values(dailyStats).sort((a, b) => {
                return new Date(b.date).getTime() - new Date(a.date).getTime();
            });

            return { data: aggregatedArray, error: null };

        } catch (error: any) {
            console.error('Failed to calculate daily stats:', error.message);
            return { data: null, error: error.message };
        }
    }
};

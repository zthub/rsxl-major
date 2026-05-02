import React, { useEffect, useState } from 'react';
import { TRAINING_MODULES } from '../constants';
import { ModuleCard } from '../components/ModuleCard';
import { useAuth } from '../utils/authContext';
import { dbService } from '../utils/dbService';
import { Activity } from 'lucide-react';

export const HomePage: React.FC = () => {
  const [dailyStats, setDailyStats] = useState<any[]>([]);
  const { session } = useAuth();

  useEffect(() => {
    if (session) {
      dbService.getDailyStatistics().then(({ data }) => {
        if (data) setDailyStats(data);
      });
    }
  }, [session]);

  return (
    <div className="space-y-8 pb-12">
      <div className="text-center space-y-2 py-8">
        <h2 className="text-3xl md:text-4xl font-bold text-slate-800">
          今天想做哪个训练？
        </h2>
        <p className="text-slate-500 text-lg">
          坚持每天打卡，让眼睛更明亮
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {TRAINING_MODULES.map((module) => (
          <ModuleCard key={module.id} module={module} />
        ))}
      </div>

      {/* Training History Section */}
      {session && (
        <div className="mt-12">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-6">
            <Activity className="text-brand-blue" />
            我的每日训练统计
          </h3>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            {dailyStats.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                暂无训练记录，快点击上方卡片开始训练吧！
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {dailyStats.map((stat: any) => (
                  <div key={stat.date} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800 text-lg">
                        {stat.date === new Date().toLocaleDateString() ? '今天' : stat.date}
                      </span>
                      <span className="text-xs text-slate-500 mt-1">
                        完成了 {stat.sessionCount} 次训练
                      </span>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="flex flex-col items-end">
                        <span className="text-xs text-slate-400 font-mono uppercase tracking-wider mb-1">总时长</span>
                        <div className="flex items-baseline gap-1">
                          <span className="font-black text-brand-blue text-2xl">
                            {stat.totalDuration >= 60 ? Math.floor(stat.totalDuration / 60) : stat.totalDuration}
                          </span>
                          <span className="text-slate-500 font-bold text-sm">
                            {stat.totalDuration >= 60 ? '分钟' : '秒'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
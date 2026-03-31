import React, { useState, useEffect, useMemo } from 'react';
import { firestoreService } from '../lib/firestore';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line,
  Legend,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { 
  TrendingUp, 
  DollarSign, 
  Users, 
  Activity, 
  Calendar, 
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Zap
} from 'lucide-react';
import { motion } from 'motion/react';

interface UsageRecord {
  userId: string;
  email: string;
  date: string;
  tokens: number;
  cost: number;
}

export default function AdminDashboard() {
  const [usageData, setUsageData] = useState<UsageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const data = await firestoreService.getUsageData();
        setUsageData(data as UsageRecord[]);
      } catch (error) {
        console.error("Error fetching usage data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const stats = useMemo(() => {
    const totalTokens = usageData.reduce((acc, curr) => acc + curr.tokens, 0);
    const totalCost = usageData.reduce((acc, curr) => acc + curr.cost, 0);
    
    const today = new Date().toISOString().split('T')[0];
    const dailyUsage = usageData.filter(d => d.date === today);
    const dailyTokens = dailyUsage.reduce((acc, curr) => acc + curr.tokens, 0);
    const dailyCost = dailyUsage.reduce((acc, curr) => acc + curr.cost, 0);

    const uniqueUsers = new Set(usageData.map(d => d.userId)).size;

    return {
      totalTokens,
      totalCost,
      dailyTokens,
      dailyCost,
      uniqueUsers
    };
  }, [usageData]);

  const chartData = useMemo(() => {
    const dailyMap = new Map<string, { date: string; tokens: number; cost: number }>();
    
    // Last 14 days
    const last14Days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    last14Days.forEach(date => {
      dailyMap.set(date, { date, tokens: 0, cost: 0 });
    });

    usageData.forEach(record => {
      if (dailyMap.has(record.date)) {
        const existing = dailyMap.get(record.date)!;
        existing.tokens += record.tokens;
        existing.cost += record.cost;
      }
    });

    return Array.from(dailyMap.values());
  }, [usageData]);

  const userUsageData = useMemo(() => {
    const userMap = new Map<string, { email: string; tokens: number; cost: number; lastActive: string }>();
    
    usageData.forEach(record => {
      if (!userMap.has(record.userId)) {
        userMap.set(record.userId, { email: record.email, tokens: 0, cost: 0, lastActive: record.date });
      }
      const existing = userMap.get(record.userId)!;
      existing.tokens += record.tokens;
      existing.cost += record.cost;
      if (record.date > existing.lastActive) {
        existing.lastActive = record.date;
      }
    });

    return Array.from(userMap.values())
      .filter(u => u.email.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => b.tokens - a.tokens);
  }, [usageData, searchTerm]);

  const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Activity className="animate-spin text-primary w-12 h-12" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-primary flex items-center gap-3">
            <TrendingUp size={32} />
            Yönetici Paneli
          </h2>
          <p className="text-slate-400 font-medium">Sistem kullanımı ve maliyet raporları</p>
        </div>
        <div className="flex items-center gap-3 bg-slate-800/50 p-2 rounded-2xl border border-slate-700/50">
          <Calendar className="text-primary w-5 h-5" />
          <span className="text-sm font-bold text-slate-300">
            {new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Günlük Token" 
          value={stats.dailyTokens.toLocaleString()} 
          icon={Zap} 
          color="blue"
          subtitle="Bugünkü toplam kullanım"
        />
        <StatCard 
          title="Günlük Maliyet" 
          value={`$${stats.dailyCost.toFixed(4)}`} 
          icon={DollarSign} 
          color="green"
          subtitle="Bugünkü tahmini maliyet"
        />
        <StatCard 
          title="Toplam Token" 
          value={stats.totalTokens.toLocaleString()} 
          icon={Activity} 
          color="purple"
          subtitle="Tüm zamanlar kullanımı"
        />
        <StatCard 
          title="Toplam Maliyet" 
          value={`$${stats.totalCost.toFixed(4)}`} 
          icon={TrendingUp} 
          color="pink"
          subtitle="Tüm zamanlar maliyeti"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Usage Chart */}
        <div className="glass p-6 rounded-[2rem] bg-slate-800/50 border-slate-700/50">
          <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Activity className="text-primary" />
            Günlük Token Kullanımı (Son 14 Gün)
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#94a3b8" 
                  fontSize={12} 
                  tickFormatter={(val) => val.split('-').slice(1).reverse().join('/')}
                />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px' }}
                  itemStyle={{ color: '#6366f1' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="tokens" 
                  stroke="#6366f1" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#6366f1' }} 
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cost Chart */}
        <div className="glass p-6 rounded-[2rem] bg-slate-800/50 border-slate-700/50">
          <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
            <DollarSign className="text-green-500" />
            Günlük Maliyet Trendi
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#94a3b8" 
                  fontSize={12} 
                  tickFormatter={(val) => val.split('-').slice(1).reverse().join('/')}
                />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px' }}
                  itemStyle={{ color: '#10b981' }}
                />
                <Bar dataKey="cost" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* User Table */}
      <div className="glass p-8 rounded-[2rem] bg-slate-800/50 border-slate-700/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Users className="text-primary" />
            Kullanıcı Bazlı Kullanım
          </h3>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Kullanıcı ara..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b border-slate-700">
                <th className="pb-4 font-bold text-slate-400 text-sm uppercase tracking-wider">Kullanıcı</th>
                <th className="pb-4 font-bold text-slate-400 text-sm uppercase tracking-wider">Toplam Token</th>
                <th className="pb-4 font-bold text-slate-400 text-sm uppercase tracking-wider">Toplam Maliyet</th>
                <th className="pb-4 font-bold text-slate-400 text-sm uppercase tracking-wider">Son Aktivite</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {userUsageData.map((user, idx) => (
                <tr key={idx} className="group hover:bg-slate-700/30 transition-colors">
                  <td className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {user.email[0].toUpperCase()}
                      </div>
                      <span className="font-bold text-slate-200">{user.email}</span>
                    </div>
                  </td>
                  <td className="py-4">
                    <span className="font-mono text-slate-300">{user.tokens.toLocaleString()}</span>
                  </td>
                  <td className="py-4">
                    <span className="font-mono text-green-400 font-bold">${user.cost.toFixed(4)}</span>
                  </td>
                  <td className="py-4">
                    <span className="text-sm text-slate-400">{user.lastActive}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, subtitle }: any) {
  const colorClasses: any = {
    blue: 'from-blue-500/20 to-indigo-500/20 text-blue-500',
    green: 'from-emerald-500/20 to-teal-500/20 text-emerald-500',
    purple: 'from-purple-500/20 to-violet-500/20 text-purple-500',
    pink: 'from-pink-500/20 to-rose-500/20 text-pink-500',
  };

  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="glass p-6 rounded-[2rem] bg-slate-800/50 border-slate-700/50 relative overflow-hidden group"
    >
      <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${colorClasses[color]} blur-3xl opacity-20 group-hover:opacity-40 transition-opacity`} />
      <div className="relative z-10 space-y-4">
        <div className={`p-3 rounded-2xl bg-gradient-to-br ${colorClasses[color]} w-fit`}>
          <Icon size={24} />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">{title}</p>
          <h4 className="text-2xl font-black text-white mt-1">{value}</h4>
          {subtitle && <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase">{subtitle}</p>}
        </div>
      </div>
    </motion.div>
  );
}

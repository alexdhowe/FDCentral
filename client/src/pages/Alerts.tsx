import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bell, Plus, Trash2, RefreshCw, TrendingUp, TrendingDown, Activity, Volume2 } from 'lucide-react';
import api from '../lib/api';
import { formatCurrency, getTimeSince } from '../lib/utils';
import toast from 'react-hot-toast';

interface Alert {
  id: string;
  symbol: string;
  alert_type: string;
  trigger_value: number;
  is_active: boolean;
  is_triggered: boolean;
  triggered_at: string | null;
  created_at: string;
}

const alertTypes = [
  { value: 'price_above', label: 'Price Above', icon: TrendingUp, color: 'text-green-400' },
  { value: 'price_below', label: 'Price Below', icon: TrendingDown, color: 'text-red-400' },
  { value: 'percent_change_up', label: '% Change Up', icon: TrendingUp, color: 'text-green-400' },
  { value: 'percent_change_down', label: '% Change Down', icon: TrendingDown, color: 'text-red-400' },
  { value: 'volume_spike', label: 'Volume Spike', icon: Volume2, color: 'text-purple-400' },
];

export default function Alerts() {
  const [searchParams] = useSearchParams();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [triggeredAlerts, setTriggeredAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newAlert, setNewAlert] = useState({
    symbol: searchParams.get('symbol') || '',
    alertType: 'price_above',
    triggerValue: '',
  });

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      const [alertsRes, triggeredRes] = await Promise.all([
        api.get('/alerts'),
        api.get('/alerts/triggered'),
      ]);

      setAlerts(alertsRes.data.filter((a: Alert) => !a.is_triggered));
      setTriggeredAlerts(triggeredRes.data);
    } catch (error) {
      toast.error('Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  const createAlert = async () => {
    if (!newAlert.symbol || !newAlert.triggerValue) {
      toast.error('Please fill all fields');
      return;
    }

    try {
      await api.post('/alerts', {
        symbol: newAlert.symbol.toUpperCase(),
        alertType: newAlert.alertType,
        triggerValue: parseFloat(newAlert.triggerValue),
      });

      toast.success('Alert created!');
      setShowModal(false);
      setNewAlert({ symbol: '', alertType: 'price_above', triggerValue: '' });
      fetchAlerts();
    } catch (error) {
      toast.error('Failed to create alert');
    }
  };

  const deleteAlert = async (id: string) => {
    try {
      await api.delete(`/alerts/${id}`);
      setAlerts(alerts.filter((a) => a.id !== id));
      setTriggeredAlerts(triggeredAlerts.filter((a) => a.id !== id));
      toast.success('Alert deleted');
    } catch (error) {
      toast.error('Failed to delete alert');
    }
  };

  const resetAlert = async (id: string) => {
    try {
      await api.post(`/alerts/${id}/reset`);
      fetchAlerts();
      toast.success('Alert reset');
    } catch (error) {
      toast.error('Failed to reset alert');
    }
  };

  const getAlertTypeInfo = (type: string) => {
    return alertTypes.find((t) => t.value === type) || alertTypes[0];
  };

  const getAlertDescription = (alert: Alert) => {
    const typeInfo = getAlertTypeInfo(alert.alert_type);
    switch (alert.alert_type) {
      case 'price_above':
        return `${alert.symbol} goes above ${formatCurrency(alert.trigger_value)}`;
      case 'price_below':
        return `${alert.symbol} goes below ${formatCurrency(alert.trigger_value)}`;
      case 'percent_change_up':
        return `${alert.symbol} increases by ${alert.trigger_value}%`;
      case 'percent_change_down':
        return `${alert.symbol} decreases by ${alert.trigger_value}%`;
      case 'volume_spike':
        return `${alert.symbol} volume exceeds ${(alert.trigger_value / 1000000).toFixed(1)}M`;
      default:
        return `${alert.symbol} alert`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Price Alerts</h1>
          <p className="text-gray-400">Get notified when stocks hit your targets</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Alert
        </button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Active Alerts */}
        <div>
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary-400" />
            Active Alerts
          </h2>

          {loading ? (
            <div className="card divide-y divide-gray-700 animate-pulse">
              {Array(3)
                .fill(0)
                .map((_, i) => (
                  <div key={i} className="p-4">
                    <div className="h-5 bg-gray-700 rounded w-32 mb-2"></div>
                    <div className="h-4 bg-gray-700 rounded w-48"></div>
                  </div>
                ))}
            </div>
          ) : alerts.length > 0 ? (
            <div className="card divide-y divide-gray-700">
              {alerts.map((alert) => {
                const typeInfo = getAlertTypeInfo(alert.alert_type);
                const Icon = typeInfo.icon;

                return (
                  <div key={alert.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 bg-gray-700 rounded-lg ${typeInfo.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium">{alert.symbol}</p>
                        <p className="text-sm text-gray-400">{getAlertDescription(alert)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteAlert(alert.id)}
                      className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card p-8 text-center">
              <Bell className="w-12 h-12 mx-auto mb-3 text-gray-600" />
              <p className="text-gray-400">No active alerts</p>
            </div>
          )}
        </div>

        {/* Triggered Alerts */}
        <div>
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5 text-yellow-400" />
            Triggered Alerts
          </h2>

          {loading ? (
            <div className="card divide-y divide-gray-700 animate-pulse">
              {Array(3)
                .fill(0)
                .map((_, i) => (
                  <div key={i} className="p-4">
                    <div className="h-5 bg-gray-700 rounded w-32 mb-2"></div>
                    <div className="h-4 bg-gray-700 rounded w-48"></div>
                  </div>
                ))}
            </div>
          ) : triggeredAlerts.length > 0 ? (
            <div className="card divide-y divide-gray-700">
              {triggeredAlerts.map((alert) => {
                const typeInfo = getAlertTypeInfo(alert.alert_type);
                const Icon = typeInfo.icon;

                return (
                  <div key={alert.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-yellow-900/50 rounded-lg text-yellow-400">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium">{alert.symbol}</p>
                        <p className="text-sm text-gray-400">{getAlertDescription(alert)}</p>
                        <p className="text-xs text-yellow-400 mt-1">
                          Triggered {alert.triggered_at ? getTimeSince(alert.triggered_at) : 'recently'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => resetAlert(alert.id)}
                        className="p-2 text-gray-400 hover:text-primary-400 transition-colors"
                        title="Reset alert"
                      >
                        <RefreshCw className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => deleteAlert(alert.id)}
                        className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card p-8 text-center">
              <Bell className="w-12 h-12 mx-auto mb-3 text-gray-600" />
              <p className="text-gray-400">No triggered alerts</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Alert Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Create Alert</h3>

            <div className="space-y-4">
              <div>
                <label className="label">Symbol</label>
                <input
                  type="text"
                  value={newAlert.symbol}
                  onChange={(e) => setNewAlert({ ...newAlert, symbol: e.target.value.toUpperCase() })}
                  placeholder="AAPL"
                  className="input"
                />
              </div>

              <div>
                <label className="label">Alert Type</label>
                <select
                  value={newAlert.alertType}
                  onChange={(e) => setNewAlert({ ...newAlert, alertType: e.target.value })}
                  className="input"
                >
                  {alertTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">
                  {newAlert.alertType.includes('percent')
                    ? 'Percentage'
                    : newAlert.alertType === 'volume_spike'
                    ? 'Volume Threshold'
                    : 'Price'}
                </label>
                <input
                  type="number"
                  value={newAlert.triggerValue}
                  onChange={(e) => setNewAlert({ ...newAlert, triggerValue: e.target.value })}
                  placeholder={
                    newAlert.alertType.includes('percent')
                      ? '5'
                      : newAlert.alertType === 'volume_spike'
                      ? '10000000'
                      : '150.00'
                  }
                  className="input"
                  step="any"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-6">
              <button onClick={() => setShowModal(false)} className="btn-ghost">
                Cancel
              </button>
              <button onClick={createAlert} className="btn-primary">
                Create Alert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

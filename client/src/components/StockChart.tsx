import { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, LineData } from 'lightweight-charts';
import api from '../lib/api';

interface StockChartProps {
  symbol: string;
  height?: number;
  chartType?: 'candlestick' | 'line';
}

const periods = [
  { label: '1D', value: '1d', interval: '5m' },
  { label: '1W', value: '5d', interval: '15m' },
  { label: '1M', value: '1mo', interval: '1h' },
  { label: '3M', value: '3mo', interval: '1d' },
  { label: '1Y', value: '1y', interval: '1d' },
  { label: '5Y', value: '5y', interval: '1wk' },
];

export default function StockChart({ symbol, height = 400, chartType = 'candlestick' }: StockChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | ISeriesApi<'Line'> | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState(periods[2]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#1f2937' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: '#374151' },
        horzLines: { color: '#374151' },
      },
      width: chartContainerRef.current.clientWidth,
      height,
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: '#374151',
      },
      timeScale: {
        borderColor: '#374151',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [height]);

  useEffect(() => {
    if (!chartRef.current) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await api.get(`/stocks/history/${symbol}`, {
          params: { period: selectedPeriod.value, interval: selectedPeriod.interval },
        });

        const data = response.data;

        // Remove old series
        if (seriesRef.current) {
          chartRef.current?.removeSeries(seriesRef.current);
        }

        if (chartType === 'candlestick') {
          const candleSeries = chartRef.current!.addCandlestickSeries({
            upColor: '#22c55e',
            downColor: '#ef4444',
            borderDownColor: '#ef4444',
            borderUpColor: '#22c55e',
            wickDownColor: '#ef4444',
            wickUpColor: '#22c55e',
          });

          const candleData: CandlestickData[] = data.map((d: any) => ({
            time: Math.floor(new Date(d.date).getTime() / 1000),
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
          }));

          candleSeries.setData(candleData);
          seriesRef.current = candleSeries;
        } else {
          const lineSeries = chartRef.current!.addLineSeries({
            color: '#0ea5e9',
            lineWidth: 2,
          });

          const lineData: LineData[] = data.map((d: any) => ({
            time: Math.floor(new Date(d.date).getTime() / 1000),
            value: d.close,
          }));

          lineSeries.setData(lineData);
          seriesRef.current = lineSeries;
        }

        chartRef.current?.timeScale().fitContent();
      } catch (error) {
        console.error('Failed to fetch chart data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [symbol, selectedPeriod, chartType]);

  return (
    <div className="relative">
      <div className="flex gap-2 mb-4">
        {periods.map((period) => (
          <button
            key={period.value}
            onClick={() => setSelectedPeriod(period)}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              selectedPeriod.value === period.value
                ? 'bg-primary-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {period.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800/50 z-10">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      )}

      <div ref={chartContainerRef} className="rounded-lg overflow-hidden" />
    </div>
  );
}

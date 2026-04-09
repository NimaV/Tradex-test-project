import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

type MarketItem = {
  symbol: string;
  name: string;
  price: number | null;
  change24h: number | null;
  type: string;
};

type ChartPoint = {
  time: string;
  price: number;
};

type TickerResponse = {
  success: boolean;
  data: MarketItem[];
  lastUpdated?: string;
  cached?: boolean;
  cacheError?: string | null;
};

type ChartResponse = {
  success: boolean;
  symbol: string;
  name: string;
  data: ChartPoint[];
  note?: string;
};

type PopupPosition = {
  left: number;
  top: number;
};

const API_BASE = 'http://localhost:3001/api/market';
const REPEAT_COUNT = 6;
const POPUP_WIDTH = 320;
const POPUP_GAP = 10;

function formatPrice(symbol: string, price: number | null) {
  if (price === null || price === undefined) return '--';
  if (symbol === 'XRP') return `$${price.toFixed(4)}`;
  return `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function formatChange(change: number | null) {
  if (change === null || change === undefined) return '--';
  return `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
}

function repeatItems(items: MarketItem[], count: number) {
  const result: MarketItem[] = [];
  for (let i = 0; i < count; i += 1) {
    result.push(...items);
  }
  return result;
}

export default function MarketTickerBar() {
  const [items, setItems] = useState<MarketItem[]>([]);
  const [displayItems, setDisplayItems] = useState<MarketItem[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [hoveredItem, setHoveredItem] = useState<MarketItem | null>(null);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [popupPosition, setPopupPosition] = useState<PopupPosition>({
    left: 16,
    top: 72,
  });

  const hoverTimeoutRef = useRef<number | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const repeatedItems = useMemo(
    () => repeatItems(displayItems, REPEAT_COUNT),
    [displayItems]
  );

  const fetchTicker = async () => {
    try {
      const res = await fetch(`${API_BASE}/ticker`);
      const json: TickerResponse = await res.json();

      if (json.success) {
        setItems(json.data);
        setLastUpdated(json.lastUpdated || null);

        setDisplayItems((prev) => {
          if (prev.length === 0) return json.data;
          return prev;
        });
      }
    } catch (error) {
      console.error('Failed to fetch ticker data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchChart = async (symbol: string) => {
    try {
      setChartLoading(true);
      const res = await fetch(`${API_BASE}/chart/${symbol}`);
      const json: ChartResponse = await res.json();

      if (json.success) {
        setChartData(json.data || []);
      } else {
        setChartData([]);
      }
    } catch (error) {
      console.error('Failed to fetch chart data:', error);
      setChartData([]);
    } finally {
      setChartLoading(false);
    }
  };

  useEffect(() => {
    fetchTicker();

    const interval = window.setInterval(() => {
      fetchTicker();
    }, 30000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const handleIteration = () => {
      setDisplayItems((prev) => {
        if (items.length === 0) return prev;
        return items;
      });
    };

    track.addEventListener('animationiteration', handleIteration);

    return () => {
      track.removeEventListener('animationiteration', handleIteration);
    };
  }, [items]);

  const updatePopupPosition = (cardElement: HTMLDivElement) => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const wrapperRect = wrapper.getBoundingClientRect();
    const cardRect = cardElement.getBoundingClientRect();

    let left =
      cardRect.left - wrapperRect.left + cardRect.width / 2 - POPUP_WIDTH / 2;

    const minLeft = 8;
    const maxLeft = wrapperRect.width - POPUP_WIDTH - 8;

    if (left < minLeft) left = minLeft;
    if (left > maxLeft) left = Math.max(minLeft, maxLeft);

    const top =
      cardRect.top - wrapperRect.top + cardRect.height + POPUP_GAP;

    setPopupPosition({ left, top });
  };

  const handleMouseEnter = (
    item: MarketItem,
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
    }

    updatePopupPosition(event.currentTarget);
    setHoveredItem(item);
    fetchChart(item.symbol);
  };

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = window.setTimeout(() => {
      setHoveredItem(null);
      setChartData([]);
    }, 120);
  };

  return (
    <div className="mb-6">
      <div
        ref={wrapperRef}
        className="relative overflow-visible rounded-xl border bg-card shadow-sm"
      >
        <div className="flex items-center justify-between border-b px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Live Markets</span>
            <span className="inline-flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          </div>

          <div className="text-xs text-muted-foreground">
            {loading
              ? 'Loading...'
              : lastUpdated
                ? `Updated ${new Date(lastUpdated).toLocaleTimeString()}`
                : 'Live'}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-b-xl">
          <div
            ref={trackRef}
            className="market-ticker-track flex min-w-max items-center gap-4 py-3"
          >
            {repeatedItems.map((item, index) => {
              const isPositive = (item.change24h ?? 0) >= 0;

              return (
                <div
                  key={`${item.symbol}-${index}`}
                  className="group relative flex w-[220px] shrink-0 cursor-pointer items-center justify-between rounded-lg border bg-background/70 px-4 py-3 transition-all hover:scale-[1.02] hover:shadow-md"
                  onMouseEnter={(event) => handleMouseEnter(item, event)}
                  onMouseLeave={handleMouseLeave}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{item.symbol}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {item.name}
                    </div>
                  </div>

                  <div className="ml-4 text-right">
                    <div className="text-sm font-semibold">
                      {formatPrice(item.symbol, item.price)}
                    </div>
                    <div
                      className={`text-xs font-medium ${
                        isPositive ? 'text-green-500' : 'text-red-500'
                      }`}
                    >
                      {formatChange(item.change24h)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {hoveredItem && (
          <div
            className="absolute z-20 w-[320px] rounded-xl border bg-popover p-4 shadow-2xl"
            style={{
              left: `${popupPosition.left}px`,
              top: `${popupPosition.top}px`,
            }}
            onMouseEnter={() => {
              if (hoverTimeoutRef.current) {
                window.clearTimeout(hoverTimeoutRef.current);
              }
            }}
            onMouseLeave={handleMouseLeave}
          >
            <div className="mb-3 flex items-start justify-between">
              <div>
                <div className="text-sm font-semibold">{hoveredItem.name}</div>
                <div className="text-xs text-muted-foreground">
                  {hoveredItem.symbol}
                </div>
              </div>

              <div className="text-right">
                <div className="text-sm font-semibold">
                  {formatPrice(hoveredItem.symbol, hoveredItem.price)}
                </div>
                <div
                  className={`text-xs font-medium ${
                    (hoveredItem.change24h ?? 0) >= 0
                      ? 'text-green-500'
                      : 'text-red-500'
                  }`}
                >
                  {formatChange(hoveredItem.change24h)}
                </div>
              </div>
            </div>

            <div className="h-40">
              {chartLoading ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Loading chart...
                </div>
              ) : chartData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  No chart data
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
                  >
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      hide
                      domain={['dataMin - 1%', 'dataMax + 1%']}
                    />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="price"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2.5}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="mt-2 text-[11px] text-muted-foreground">
              Last 24h preview
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

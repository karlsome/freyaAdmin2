function PayoutsCard() {
  return (
    <div className="col-span-8 glass-card rounded-2xl p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] -mr-32 -mt-32 pointer-events-none"></div>

      <div className="flex justify-between items-start mb-10 relative z-10">
        <div>
          <h3 className="text-lg font-bold text-on-surface mb-1">Payouts &amp; Volume Tracker</h3>
          <p className="text-xs text-on-surface-variant">Live transaction throughput vs operational costs</p>
        </div>
        <div className="flex items-center gap-2 bg-surface-container-high p-1 rounded-lg">
          <button className="px-3 py-1 text-[10px] font-bold rounded-md bg-primary/15 text-primary">Daily</button>
          <button className="px-3 py-1 text-[10px] font-bold rounded-md text-outline hover:text-on-surface">Weekly</button>
        </div>
      </div>

      <div className="h-64 relative mb-6">
        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="grad1" x1="0%" x2="0%" y1="0%" y2="100%">
              <stop offset="0%" style={{ stopColor: "rgba(99,102,241,0.35)", stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: "rgba(99,102,241,0)", stopOpacity: 1 }} />
            </linearGradient>
          </defs>
          <path d="M0,180 Q100,120 200,150 T400,80 T600,110 T800,40 L800,240 L0,240 Z" fill="url(#grad1)" />
          <path d="M0,180 Q100,120 200,150 T400,80 T600,110 T800,40" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" />
        </svg>

        <div className="absolute top-4 left-4 flex gap-8 z-10">
          <div>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">Total Payout</p>
            <p className="text-2xl font-black text-on-surface">$142,804.22</p>
          </div>
          <div>
            <p className="text-[10px] text-tertiary uppercase tracking-widest font-bold">Unit Volume</p>
            <p className="text-2xl font-black text-on-surface">2.4M<span className="text-xs text-on-surface-variant font-medium ml-1">kwh</span></p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 relative z-10 border-t border-outline-variant/20 pt-6">
        <div className="space-y-1">
          <p className="text-[10px] text-on-surface-variant">Efficiency</p>
          <p className="text-sm font-bold text-on-surface">98.4% <span className="text-emerald-500 text-[10px]">↑ 2%</span></p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] text-on-surface-variant">Avg Latency</p>
          <p className="text-sm font-bold text-on-surface">12ms <span className="text-outline text-[10px]">stable</span></p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] text-on-surface-variant">Active Nodes</p>
          <p className="text-sm font-bold text-on-surface">1,402 <span className="text-primary text-[10px]">active</span></p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] text-on-surface-variant">Peak Demand</p>
          <p className="text-sm font-bold text-on-surface">04:12 <span className="text-outline text-[10px]">UTC</span></p>
        </div>
      </div>
    </div>
  );
}

function FactoryStatusCard() {
  return (
    <div className="col-span-4 glass-card rounded-2xl p-6 flex flex-col">
      <h3 className="text-lg font-bold text-on-surface mb-6">Factory Status Overview</h3>
      <div className="space-y-4 flex-1">
        <div className="p-4 rounded-xl bg-surface-container border border-outline-variant/20 hover:bg-surface-container-high transition-colors">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold text-on-surface">Active Facilities</span>
            <span className="flex items-center gap-1 text-[10px] font-black text-emerald-600 dark:text-emerald-400">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
              ONLINE
            </span>
          </div>
          <div className="text-3xl font-black text-on-surface mb-1">24</div>
          <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
            <div className="bg-primary h-full w-[85%] rounded-full"></div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-surface-container border border-outline-variant/20 hover:bg-surface-container-high transition-colors">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold text-on-surface">Idle / Maintenance</span>
            <span className="text-[10px] font-black text-outline">STANDBY</span>
          </div>
          <div className="text-3xl font-black text-on-surface mb-1">04</div>
          <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
            <div className="bg-outline h-full w-[15%] rounded-full"></div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-primary/8 border border-primary/20" style={{ background: 'rgb(var(--c-primary) / 0.08)' }}>
          <p className="text-[10px] text-primary font-bold uppercase tracking-wider mb-2">Next Scheduled Sync</p>
          <div className="flex items-end justify-between">
            <span className="text-xl font-black text-on-surface">02:44:11</span>
            <button className="text-xs font-bold text-primary underline">Details</button>
          </div>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-outline-variant/20">
        <div className="w-full h-24 rounded-lg bg-surface-container-high flex items-center justify-center">
          <span className="text-[10px] text-outline uppercase tracking-widest">Global Map</span>
        </div>
      </div>
    </div>
  );
}

function IncomeCard() {
  const bars = [
    { h: "40%", opacity: 0.2 },
    { h: "60%", opacity: 0.4 },
    { h: "90%", opacity: 0.6 },
    { h: "50%", opacity: 0.3 },
    { h: "100%", opacity: 0.9, glow: true },
    { h: "70%", opacity: 0.5 },
  ];

  return (
    <div className="col-span-5 glass-card rounded-2xl p-6">
      <div className="flex justify-between items-center mb-8">
        <h3 className="text-lg font-bold text-on-surface">Income &amp; Growth</h3>
        <span className="material-symbols-outlined text-outline cursor-pointer">more_horiz</span>
      </div>

      <div className="w-full h-32 flex items-end gap-2 mb-8">
        {bars.map((bar, i) => (
          <div
            key={i}
            className={`w-full rounded-t-sm transition-opacity ${bar.glow ? "shadow-lg shadow-primary/30" : ""}`}
            style={{
              height: bar.h,
              background: `rgb(var(--c-primary) / ${bar.opacity})`,
            }}
          />
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center px-2 py-2 rounded-lg hover:bg-surface-container transition-colors">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-primary"></span>
            <span className="text-sm font-medium text-on-surface-variant">Projected Revenue</span>
          </div>
          <span className="text-sm font-bold text-on-surface">+$4.2M</span>
        </div>
        <div className="flex justify-between items-center px-2 py-2 rounded-lg hover:bg-surface-container transition-colors">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-tertiary"></span>
            <span className="text-sm font-medium text-on-surface-variant">Maintenance Cost</span>
          </div>
          <span className="text-sm font-bold text-on-surface">-$1.1M</span>
        </div>
        <div className="flex justify-between items-center px-2 py-2 rounded-lg hover:bg-surface-container transition-colors">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-secondary"></span>
            <span className="text-sm font-medium text-on-surface-variant">Expansion Budget</span>
          </div>
          <span className="text-sm font-bold text-on-surface">$850k</span>
        </div>
      </div>
    </div>
  );
}

function RecentActivityCard() {
  const activities = [
    {
      icon: "warning",
      bgClass: "bg-error/10",
      colorClass: "text-error",
      title: "Pressure spike in Sector 7",
      time: "2 mins ago • Automatic containment engaged",
      dim: false,
    },
    {
      icon: "check_circle",
      bgClass: "bg-primary/10",
      colorClass: "text-primary",
      title: "Shift Rotation Complete",
      time: "45 mins ago • All 140 workers checked out",
      dim: false,
    },
    {
      icon: "sync",
      bgClass: "bg-tertiary/10",
      colorClass: "text-tertiary",
      title: "Firmware Update: SCNA-v2",
      time: "2 hours ago • Successfully deployed to 12 factories",
      dim: false,
    },
    {
      icon: "inventory_2",
      bgClass: "bg-outline/10",
      colorClass: "text-outline",
      title: "Low Stock: Liquid Coolant",
      time: "5 hours ago • Auto-order triggered",
      dim: true,
    },
  ];

  return (
    <div className="col-span-4 glass-card rounded-2xl p-6">
      <h3 className="text-lg font-bold text-on-surface mb-6">Recent Activity</h3>
      <div className="space-y-6">
        {activities.map((a, i) => (
          <div key={i} className={`flex gap-4 ${a.dim ? "opacity-40" : ""}`}>
            <div className={`w-8 h-8 rounded-full ${a.bgClass} flex items-center justify-center ${a.colorClass} flex-shrink-0`}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{a.icon}</span>
            </div>
            <div>
              <p className="text-sm text-on-surface font-bold">{a.title}</p>
              <p className="text-xs text-on-surface-variant">{a.time}</p>
            </div>
          </div>
        ))}
      </div>
      <button className="w-full mt-8 py-2 text-xs font-bold text-outline hover:text-on-surface transition-colors">
        VIEW ALL LOGS
      </button>
    </div>
  );
}

function InventoryCard() {
  const items = [
    { label: "Raw Carbon Fiber", pct: 82, colorClass: "bg-primary" },
    { label: "Graphene Sheets", pct: 45, colorClass: "bg-primary" },
    { label: "Titanium Alloy", pct: 12, colorClass: "bg-error" },
  ];

  return (
    <div className="col-span-3 glass-card rounded-2xl p-6 flex flex-col justify-between">
      <div>
        <h3 className="text-lg font-bold text-on-surface mb-4">Inventory Levels</h3>
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.label}>
              <div className="flex justify-between text-[10px] font-bold uppercase text-outline mb-1">
                <span>{item.label}</span>
                <span>{item.pct}%</span>
              </div>
              <div className="h-1 bg-surface-container-high rounded-full">
                <div className={`h-full ${item.colorClass} rounded-full`} style={{ width: `${item.pct}%` }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 p-3 rounded-xl bg-surface-container-high border border-outline-variant/20">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-tertiary">shopping_cart</span>
          <div>
            <p className="text-[10px] font-bold text-on-surface">Pending Orders</p>
            <p className="text-[10px] text-on-surface-variant">04 Shipments inbound</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <section className="pt-24 pb-12 px-8 overflow-y-auto h-screen scrollbar-hide">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-bold font-headline tracking-tight text-on-surface">Kinetic Observatory</h2>
          <p className="text-on-surface-variant mt-1">Real-time telemetrics for Global Unit Cluster 04</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 rounded-lg text-xs font-bold bg-surface-container border border-outline-variant text-on-surface-variant hover:bg-surface-container-high transition-colors">
            Export Report
          </button>
          <button className="px-4 py-2 rounded-lg text-xs font-bold kinetic-gradient text-white hover:opacity-90 transition-opacity shadow-lg shadow-primary/20">
            Deploy Command
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 pb-24">
        <PayoutsCard />
        <FactoryStatusCard />
        <IncomeCard />
        <RecentActivityCard />
        <InventoryCard />
      </div>
    </section>
  );
}

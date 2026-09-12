import { Link } from 'react-router-dom';
import { Droplets, Gauge, Waves, Sprout, ArrowUpRight } from 'lucide-react';
import PivotMotif from '../components/PivotMotif.jsx';

const capabilities = [
  {
    icon: Droplets,
    title: 'Moisture-led watering',
    body: 'A capacitive sensor reads soil moisture continuously and starts the pump only when the root zone actually needs it — no fixed schedules, no guessing.',
  },
  {
    icon: Waves,
    title: 'Self-managing tank',
    body: 'An ultrasonic sensor tracks water level and refills automatically before the tank runs dry, then stops the instant it is full.',
  },
  {
    icon: Gauge,
    title: 'One dashboard, full picture',
    body: 'Moisture, tank level, and pump state stream in over MQTT so you can watch the field and step in manually whenever you want.',
  },
  {
    icon: Sprout,
    title: 'Built to grow',
    body: 'The sensor layer is modular — pH, temperature and humidity plug in now, and an AI layer for irrigation recommendations is next.',
  },
];

export default function Landing() {
  return (
    <div className="bg-soil-950 text-cream-100 font-body">
      <Nav />
      <Hero />
      <Capabilities />
      <FutureAI />
      <CTA />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="max-w-6xl mx-auto flex items-center justify-between px-6 py-6">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-water-400" />
        <span className="font-display text-xl tracking-tight">Terraflow</span>
      </div>
      <nav className="hidden md:flex items-center gap-8 text-sm text-cream-400">
        <a href="#capabilities" className="hover:text-cream-100 transition-colors">System</a>
        <a href="#future" className="hover:text-cream-100 transition-colors">Roadmap</a>
        <Link
          to="/dashboard"
          className="text-cream-100 bg-soil-800 border border-soil-600 rounded-full px-4 py-2 hover:border-water-400 transition-colors"
        >
          Open dashboard
        </Link>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center opacity-90 pointer-events-none">
        <PivotMotif className="w-[640px] h-[640px] max-w-none" />
      </div>

      <div className="relative max-w-3xl mx-auto text-center px-6 pt-20 pb-32">
        <p className="text-water-300 text-sm tracking-wide mb-5">A field-tested irrigation system, not a demo</p>
        <h1 className="font-display font-medium text-5xl md:text-6xl leading-[1.08] text-cream-100">
          Water the soil it actually needs, refill the tank before it runs out.
        </h1>
        <p className="mt-6 text-cream-400 text-lg leading-relaxed max-w-xl mx-auto">
          Terraflow pairs a soil moisture sensor and an ultrasonic tank gauge with an ESP32,
          so watering responds to real conditions in the ground instead of a timer.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            to="/dashboard"
            className="bg-water-500 hover:bg-water-400 transition-colors text-soil-950 font-medium rounded-full px-6 py-3 flex items-center gap-2"
          >
            View live dashboard <ArrowUpRight size={16} />
          </Link>
          <a
            href="#capabilities"
            className="text-cream-200 border border-soil-600 hover:border-cream-400 transition-colors rounded-full px-6 py-3"
          >
            How it works
          </a>
        </div>
      </div>
    </section>
  );
}

function Capabilities() {
  return (
    <section id="capabilities" className="bg-cream-100 text-soil-950">
      <div className="max-w-6xl mx-auto px-6 py-24">
        <div className="max-w-xl mb-14">
          <h2 className="font-display text-3xl md:text-4xl font-medium">Four sensors, one decision loop</h2>
          <p className="mt-4 text-soil-700 leading-relaxed">
            Each reading feeds directly into what the pumps do next — the dashboard is a window
            into that loop, not a separate system you have to keep in sync with.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-px bg-soil-700/10 border border-soil-700/10 rounded-2xl overflow-hidden">
          {capabilities.map(({ icon: Icon, title, body }) => (
            <div key={title} className="bg-cream-100 p-8">
              <Icon size={22} className="text-water-500 mb-4" strokeWidth={1.75} />
              <h3 className="font-display text-xl mb-2">{title}</h3>
              <p className="text-soil-700 text-sm leading-relaxed max-w-sm">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FutureAI() {
  return (
    <section id="future" className="bg-soil-900 text-cream-100">
      <div className="max-w-6xl mx-auto px-6 py-24 grid md:grid-cols-[1fr,1.1fr] gap-12 items-center">
        <div>
          <p className="text-clay-400 text-sm mb-4">What's next</p>
          <h2 className="font-display text-3xl md:text-4xl font-medium leading-tight">
            The sensor data is already being shaped for a model to read.
          </h2>
          <p className="mt-5 text-cream-400 leading-relaxed">
            Every reading Terraflow collects — moisture trends, refill frequency, tank draw-down —
            is timestamped and stored the same way. That history is what an irrigation
            recommendation model will eventually train on, without changing how the hardware works today.
          </p>
        </div>
        <div className="bg-soil-800 border border-soil-600 rounded-2xl p-8">
          <div className="text-xs text-cream-400 mb-5">planned</div>
          <ul className="space-y-4 text-sm">
            {[
              'Predict tomorrow\'s watering need from today\'s moisture curve',
              'Flag a sensor drifting out of its normal range before it fails',
              'Suggest a refill schedule based on tank draw-down history',
            ].map((line) => (
              <li key={line} className="flex gap-3 items-start">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-growth-500 shrink-0" />
                <span className="text-cream-200">{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="bg-cream-100 text-soil-950">
      <div className="max-w-6xl mx-auto px-6 py-20 text-center">
        <h2 className="font-display text-3xl md:text-4xl font-medium max-w-xl mx-auto">
          The dashboard is where the readings and the controls meet.
        </h2>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 mt-8 bg-soil-950 text-cream-100 rounded-full px-6 py-3 hover:bg-soil-800 transition-colors"
        >
          Open dashboard <ArrowUpRight size={16} />
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-soil-950 text-cream-400 border-t border-soil-700">
      <div className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between text-sm">
        <span>Terraflow — smart irrigation, IoT mini-project</span>
        <span>ESP32-S3 · MQTT · Node-RED</span>
      </div>
    </footer>
  );
}

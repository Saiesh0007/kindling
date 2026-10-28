import { HeartHandshake, Phone } from 'lucide-react'
import { Screen } from '../components/ui.jsx'

export default function Support({ message, onBack }) {
  return (
    <Screen className="pt-[34vh]">
      <div className="glass p-6">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-300 to-violet-500">
          <HeartHandshake className="h-6 w-6 text-night-950" />
        </div>
        <h1 className="font-display text-2xl font-extrabold"><span className="text-gradient-cool">You matter more than any task.</span></h1>
        <p className="mt-3 leading-relaxed text-slate-200">{message}</p>
        <div className="mt-5 grid gap-2">
          <a href="tel:14416" className="btn-primary"><Phone className="h-4 w-4" /> Call Tele-MANAS · 14416</a>
          <button onClick={onBack} className="btn-ghost">Back to a calm space</button>
        </div>
      </div>
    </Screen>
  )
}

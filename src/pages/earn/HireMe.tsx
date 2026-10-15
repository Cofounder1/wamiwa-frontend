import { useEffect, useState } from 'react'
import { Eye, ImagePlus, Trash2 } from 'lucide-react'
import { api, ApiError, mediaUrl } from '@/api/client'
import { useApi } from '@/api/hooks'
import type { ProfileDto } from '@/api/types'
import { useSession } from '@/context/session'
import { usd } from '@/lib/format'
import { Badge, Button, Callout, Card, CardHeader, Field, Input, PageHeader, Switch, toast } from '@/components/ui/primitives'
import { ErrorState, Spinner } from '@/components/ui/states'

interface InfluencerPage { photos: string[]; videos: string[]; starting_price_cents: number; available: boolean; past_hires: number; rating: number | null }

export default function HireMe() {
  const { me } = useSession()
  const profile = useApi((s) => api.get<ProfileDto>(`/profiles/${me.handle}`, undefined, s), [me.handle])
  const page = useApi((s) => api.get<InfluencerPage>(`/hire-me/influencers/${me.id}`, undefined, s).catch(() => null), [me.id])
  const [price, setPrice] = useState(0)
  const [photos, setPhotos] = useState<string[]>([])
  const [available, setAvailable] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (page.data) { setPhotos(page.data.photos); setAvailable(page.data.available) }
    const cents = page.data?.starting_price_cents ?? profile.data?.hire_me?.starting_price_cents
    if (cents) setPrice(cents / 100)
  }, [page.data, profile.data])

  if (profile.error) return <ErrorState error={profile.error} onRetry={profile.reload} />
  if (!profile.data || page.loading) return <Spinner />

  const save = async () => {
    setBusy(true)
    try {
      await api.put('/hire-me/page', { starting_price_cents: Math.round(price * 100), photos, videos: page.data?.videos ?? [] })
      toast('Hire Me page saved')
      page.reload()
    } catch (e) { toast('Couldn’t save', e instanceof ApiError ? e.fieldMessage ?? e.message : undefined, 'danger') } finally { setBusy(false) }
  }
  const setAvail = async (v: boolean) => {
    setAvailable(v)
    try { await api.put('/hire-me/availability', { available: v }); toast(v ? 'You’re available for hire' : 'Hire Me page hidden', v ? undefined : 'New offers are blocked. Active contracts continue.') } catch (e) { setAvailable(!v); toast('Couldn’t update', e instanceof ApiError ? e.message : undefined, 'danger') }
  }
  const addPhoto = async (f?: File) => {
    if (!f) return
    const form = new FormData(); form.append('kind', 'image'); form.append('file', f)
    try { const up = await api.upload<{ ref: string }>('/uploads', form); setPhotos((p) => [...p, up.ref]) } catch (e) { toast('Upload failed', e instanceof ApiError ? e.message : undefined, 'danger') }
  }

  return (
    <div>
      <PageHeader title="Hire Me page" subtitle="What brands see when they consider hiring you as a person." actions={<><Button variant="outline" icon={<Eye className="size-4" />} to={`/app/u/${me.handle}`}>Preview</Button><Button loading={busy} disabled={price <= 0} onClick={save}>Save</Button></>} />
      {me.verification === 'none' && <Callout className="mb-6" tone="warn" title="Verify your identity first" action={<Button size="sm" to="/app/verify">Verify</Button>}>Hire Me needs ID verification (or guardian setup for under-18s).</Callout>}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Card className="p-5">
            <Switch checked={!available} onChange={(v) => setAvail(!v)} label="Not available to work as human" description="Hides this page and blocks new offers. Active contracts continue." />
          </Card>
          <Card>
            <CardHeader title="Pricing & niche" />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Starting price (USD)" hint={price > 0 ? `You receive ${usd(price * 0.8)} after Wamiwa’s 20%. Brands pay in Naira at the day’s rate.` : 'Brands see this as your starting price.'}>
                <Input type="number" min={1} value={price || ''} onChange={(e) => setPrice(+e.target.value)} suffix="USD" />
              </Field>
              <Field label="Primary niche" hint="Change niche in Settings."><Input value={me.niche ?? '—'} disabled /></Field>
            </div>
          </Card>
          <Card>
            <CardHeader title="Photos" subtitle="Your best work. Brands see these first." action={
              <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-line-strong px-3.5 text-[13px] font-semibold text-ink hover:bg-wash"><ImagePlus className="size-4" />Add<input type="file" accept="image/*" className="sr-only" onChange={(e) => addPhoto(e.target.files?.[0])} /></label>
            } />
            <div className="grid grid-cols-3 gap-2 p-5 sm:grid-cols-5">
              {photos.map((p) => (
                <div key={p} className="group relative aspect-[3/4] overflow-hidden rounded-xl bg-wash">
                  <img src={mediaUrl(p)} alt="" className="size-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0' }} />
                  <button aria-label="Remove photo" onClick={() => setPhotos((x) => x.filter((y) => y !== p))} className="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full bg-black/50 text-white opacity-0 transition group-hover:opacity-100"><Trash2 className="size-3.5" /></button>
                </div>
              ))}
              {photos.length === 0 && <p className="col-span-full text-[13px] text-ink-2">No photos yet.</p>}
            </div>
            <p className="px-5 pb-4 text-[12px] text-ink-3">Save to publish photo changes.</p>
          </Card>
        </div>
        <aside>
          <Card className="sticky top-10 p-5">
            <div className="flex items-center justify-between"><span className="text-[18px] font-extrabold text-ink">{me.name}</span><Badge tone={available ? 'teal' : 'neutral'} dot>{available ? 'Available' : 'Hidden'}</Badge></div>
            <div className="text-[13px] text-ink-2">{me.niche}</div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-surface-2 p-2"><div className="font-extrabold text-ink num">{page.data?.past_hires ?? 0}</div><div className="text-[11px] text-ink-3">hires</div></div>
              <div className="rounded-xl bg-surface-2 p-2"><div className="font-extrabold text-ink">{page.data?.rating ? page.data.rating.toFixed(1) : '—'}</div><div className="text-[11px] text-ink-3">rating</div></div>
              <div className="rounded-xl bg-surface-2 p-2"><div className="font-extrabold text-ink num">{price ? usd(price) : '—'}</div><div className="text-[11px] text-ink-3">from</div></div>
            </div>
            <p className="mt-4 text-[12px] text-ink-3">Brands pay in Naira at the day’s rate, locked for the contract. They never see other brands’ names or prices for your past hires.</p>
          </Card>
        </aside>
      </div>
    </div>
  )
}

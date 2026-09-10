import { BarChart3, Database, Home, LineChart, Menu, Moon, ShoppingBasket, Sun, WalletCards, X } from 'lucide-react'
import { Badge } from './ui'

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'داشبورد', mobileLabel: 'داشبورد', icon: Home },
  { id: 'products', label: 'کالاها', mobileLabel: 'کالاها', icon: ShoppingBasket },
  { id: 'finance', label: 'دخل‌وخرج', mobileLabel: 'دخل‌وخرج', icon: WalletCards },
  { id: 'analytics', label: 'تحلیل‌ها', mobileLabel: 'تحلیل‌ها', icon: BarChart3 },
  { id: 'data', label: 'داده و تنظیمات', mobileLabel: 'تنظیمات', icon: Database },
] as const

export type PageId = typeof NAV_ITEMS[number]['id']

type Navigate = (page: PageId) => void

export function Sidebar({ page, open, onNavigate, onClose }: { page: PageId; open: boolean; onNavigate: Navigate; onClose: () => void }) {
  return <>
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="brand">
        <div className="brand-mark"><LineChart size={23}/></div>
        <div><strong>قیمت‌نگار</strong><span>رصد قیمت، بدون سرور</span></div>
        <button className="icon-button sidebar-close" onClick={onClose} aria-label="بستن منو"><X size={20}/></button>
      </div>
      <nav aria-label="ناوبری اصلی">{NAV_ITEMS.map(item => {
        const Icon = item.icon
        return <button key={item.id} className={page === item.id ? 'active' : ''} aria-current={page === item.id ? 'page' : undefined} onClick={() => onNavigate(item.id)}><Icon size={20}/><span>{item.label}</span></button>
      })}</nav>
      <div className="sidebar-status"><div className="privacy-dot"/><div><strong>ذخیره‌سازی محلی</strong><span>ثبت‌ها فقط روی این دستگاه</span></div></div>
    </aside>
    {open ? <div className="sidebar-scrim" onClick={onClose}/> : null}
  </>
}

export function Topbar({ page, online, isDark, onMenu, onToggleTheme }: { page: PageId; online: boolean; isDark: boolean; onMenu: () => void; onToggleTheme: () => void }) {
  const title = NAV_ITEMS.find(item => item.id === page)?.label ?? 'قیمت‌نگار'
  return <header className="topbar">
    <button className="icon-button menu-button" onClick={onMenu} aria-label="باز کردن منو"><Menu size={21}/></button>
    <div className="topbar-title"><span className="desktop-page-title">{title}</span><span className="mobile-brand-title">قیمت‌نگار</span></div>
    <div className="top-actions">
      <Badge tone={online ? 'info' : 'default'}>{online ? 'داده محلی' : 'آفلاین'}</Badge>
      <button className="icon-button" onClick={onToggleTheme} title="تغییر حالت" aria-label="تغییر حالت روشن و تیره">{isDark ? <Sun size={18}/> : <Moon size={18}/>}</button>
    </div>
  </header>
}

export function MobileNavigation({ page, onNavigate }: { page: PageId; onNavigate: Navigate }) {
  return <nav className="mobile-nav" aria-label="ناوبری پایین صفحه">{NAV_ITEMS.map(item => {
    const Icon = item.icon
    return <button key={item.id} className={page === item.id ? 'active' : ''} aria-current={page === item.id ? 'page' : undefined} onClick={() => onNavigate(item.id)}><Icon size={19}/><span>{item.mobileLabel}</span></button>
  })}</nav>
}

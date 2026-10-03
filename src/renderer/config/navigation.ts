import { BookOpenText, CircleHelp, Hammer, History, House, Images } from '@lucide/vue'
import type { SidebarMenuItem } from '@renderer/types/navigation'
export const sidebarMenuItems: SidebarMenuItem[] = [
  { id: 'home', to: '/home', label: '反躬自省', icon: House },
  { id: 'workspace', to: '/', label: '集腋成裘', icon: Images },
  { id: 'history', to: '/history', label: '前车之鉴', icon: History },
  { id: 'book', to: '/book', label: '千锤百炼', icon: Hammer },
  { id: 'practice', to: '/practice', label: '温故知新', icon: BookOpenText },
  { id: 'about', to: '/about', label: '关于', icon: CircleHelp },
]

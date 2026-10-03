import { BookMarked, CircleHelp, Hammer, House, Images } from '@lucide/vue'
import type { SidebarMenuItem } from '@renderer/types/navigation'
export const sidebarMenuItems: SidebarMenuItem[] = [
  { id: 'home', to: '/home', label: '反躬自省', icon: House },
  { id: 'workspace', to: '/', label: '集腋成裘', icon: Images },
  { id: 'practice', to: '/practice', label: '千锤百炼', icon: Hammer },
  { id: 'book', to: '/book', label: '温故知新', icon: BookMarked },
  { id: 'about', to: '/about', label: '关于', icon: CircleHelp },
]

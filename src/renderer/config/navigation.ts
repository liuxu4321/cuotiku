import { BookMarked, CircleHelp, Images } from '@lucide/vue'
import type { SidebarMenuItem } from '@renderer/types/navigation'
export const sidebarMenuItems: SidebarMenuItem[] = [
  { id: 'workspace', to: '/', label: '错题收集', icon: Images },
  { id: 'book', to: '/book', label: '错题组卷', icon: BookMarked },
  { id: 'about', to: '/about', label: '关于', icon: CircleHelp },
]

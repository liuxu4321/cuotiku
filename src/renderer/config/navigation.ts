import { BookMarked, CircleHelp, GraduationCap, House, Images, Lightbulb } from '@lucide/vue'
import type { SidebarMenuItem } from '@renderer/types/navigation'
export const sidebarMenuItems: SidebarMenuItem[] = [
  { id: 'home', to: '/home', label: '首页', icon: House },
  { id: 'workspace', to: '/', label: '错题收集', icon: Images },
  { id: 'analogy', to: '/analogy', label: '举一反三', icon: Lightbulb },
  { id: 'lecture', to: '/lecture', label: '错题精讲', icon: GraduationCap },
  { id: 'book', to: '/book', label: '错题组卷', icon: BookMarked },
  { id: 'about', to: '/about', label: '关于', icon: CircleHelp },
]

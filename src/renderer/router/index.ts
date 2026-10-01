import { createRouter, createWebHashHistory } from 'vue-router'
import WorkspaceView from '@renderer/views/WorkspaceView.vue'
import HomeView from '@renderer/views/HomeView.vue'
import BookView from '@renderer/views/BookView.vue'
import ComingSoonView from '@renderer/views/ComingSoonView.vue'
import SettingsView from '@renderer/views/SettingsView.vue'
import AboutView from '@renderer/views/AboutView.vue'
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'workspace', component: WorkspaceView },
    { path: '/home', name: 'home', component: HomeView },
    {
      path: '/analogy',
      name: 'analogy',
      component: ComingSoonView,
      props: { title: '举一反三', description: '基于错题生成同类变式练习，功能开发中。' },
    },
    {
      path: '/lecture',
      name: 'lecture',
      component: ComingSoonView,
      props: { title: '错题精讲', description: '错题讲解与知识点梳理，功能开发中。' },
    },
    { path: '/book', name: 'book', component: BookView },
    { path: '/settings', name: 'settings', component: SettingsView },
    { path: '/about', name: 'about', component: AboutView },
  ],
})

import { createRouter, createWebHashHistory } from 'vue-router'
import WorkspaceView from '@renderer/views/WorkspaceView.vue'
import BookView from '@renderer/views/BookView.vue'
import SettingsView from '@renderer/views/SettingsView.vue'
import AboutView from '@renderer/views/AboutView.vue'
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'workspace', component: WorkspaceView },
    { path: '/book', name: 'book', component: BookView },
    { path: '/settings', name: 'settings', component: SettingsView },
    { path: '/about', name: 'about', component: AboutView },
  ],
})

import { createRouter, createWebHashHistory } from 'vue-router'
import WorkspaceView from '@renderer/views/WorkspaceView.vue'
import HomeView from '@renderer/views/HomeView.vue'
import BookView from '@renderer/views/BookView.vue'
import HistoryView from '@renderer/views/HistoryView.vue'
import PracticeView from '@renderer/views/PracticeView.vue'
import SettingsView from '@renderer/views/SettingsView.vue'
import AboutView from '@renderer/views/AboutView.vue'
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'workspace', component: WorkspaceView },
    { path: '/home', name: 'home', component: HomeView },
    { path: '/practice', name: 'practice', component: PracticeView },
    { path: '/history', name: 'history', component: HistoryView },
    { path: '/book', name: 'book', component: BookView },
    { path: '/settings', name: 'settings', component: SettingsView },
    { path: '/about', name: 'about', component: AboutView },
  ],
})

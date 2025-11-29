import { createBrowserRouter, Navigate } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { MarketplaceItemPage } from './pages/MarketplaceItemPage';
import { ProfilePage } from './pages/ProfilePage';
import { EditorPage } from './pages/EditorPage';
import { PlayerPage } from './pages/PlayerPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AdminPage } from './pages/AdminPage';
import { ModeratorPage } from './pages/ModeratorPage';
import { UsersManagementPage } from './pages/admin/UsersManagementPage';
import { StatsPage } from './pages/admin/StatsPage';
import { MarketplaceModerationPage as AdminMarketplacePage } from './pages/admin/MarketplaceModerationPage';
import { MarketplaceModerationPage } from './pages/moderator/MarketplaceModerationPage';
import { CommunityHubPage } from './pages/CommunityHubPage';
import { CategoryPage } from './pages/CategoryPage';
import { ThreadPage } from './pages/ThreadPage';
import { NewThreadPage } from './pages/NewThreadPage';
import { StorePage } from './pages/StorePage';
import { PurchaseHistoryPage } from './pages/PurchaseHistoryPage';
import { ShopManagementPage } from './pages/admin/ShopManagementPage';
import { ForumManagementPage } from './pages/admin/ForumManagementPage';
import { NewsManagementPage } from './pages/admin/NewsManagementPage';
import { ForumModerationPage } from './pages/moderator/ForumModerationPage';
// Avatar Builder - Modern avatar customization
import { AvatarBuilderPage } from './pages/AvatarBuilderPage';
import { StudioPage } from './pages/StudioPage';
import { SupportPage } from './pages/SupportPage';
import { TicketDetail } from './components/support/TicketDetail';
import { SupportManagementPage } from './pages/admin/SupportManagementPage';
import { ReleaseManagementPage } from './pages/admin/ReleaseManagementPage';
import { NewsPage } from './pages/NewsPage';
import { GamesPage } from './pages/GamesPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ProtectedRoute, AdminRoute, ModeratorRoute } from './components/auth/ProtectedRoute';
import { RouteErrorElement } from './components/shared/RouteErrorElement';

export const router: ReturnType<typeof createBrowserRouter> = createBrowserRouter(
  [
    {
      path: '/',
      element: <HomePage />,
      errorElement: <RouteErrorElement />,
    },
  {
    path: '/games',
    element: (
      <ProtectedRoute>
        <GamesPage />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorElement />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
  },
  {
    path: '/editor',
    element: (
      <ProtectedRoute>
        <EditorPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/player/:buildId',
    element: <PlayerPage />,
  },
  {
    path: '/marketplace',
    element: <StorePage />,
  },
  {
    path: '/marketplace/:id',
    element: <MarketplaceItemPage />,
  },
  {
    path: '/profile/:id',
    element: (
      <ProtectedRoute>
        <ProfilePage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/community-hub',
    element: (
      <ProtectedRoute>
        <CommunityHubPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/messages',
    element: <Navigate to="/community-hub?tab=messages" replace />,
  },
  {
    path: '/friends',
    element: <Navigate to="/community-hub?tab=friends" replace />,
  },
  {
    path: '/notifications',
    element: (
      <ProtectedRoute>
        <NotificationsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/settings',
    element: (
      <ProtectedRoute>
        <SettingsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin',
    element: (
      <AdminRoute>
        <AdminPage />
      </AdminRoute>
    ),
  },
  {
    path: '/admin/users',
    element: (
      <AdminRoute>
        <UsersManagementPage />
      </AdminRoute>
    ),
  },
  {
    path: '/admin/stats',
    element: (
      <AdminRoute>
        <StatsPage />
      </AdminRoute>
    ),
  },
  {
    path: '/admin/marketplace',
    element: (
      <AdminRoute>
        <AdminMarketplacePage />
      </AdminRoute>
    ),
  },
  {
    path: '/admin/shop',
    element: (
      <AdminRoute>
        <ShopManagementPage />
      </AdminRoute>
    ),
  },
  {
    path: '/admin/forum',
    element: (
      <AdminRoute>
        <ForumManagementPage />
      </AdminRoute>
    ),
  },
  {
    path: '/admin/news',
    element: (
      <AdminRoute>
        <NewsManagementPage />
      </AdminRoute>
    ),
  },
  {
    path: '/admin/support',
    element: (
      <AdminRoute>
        <SupportManagementPage />
      </AdminRoute>
    ),
  },
  {
    path: '/admin/releases',
    element: (
      <AdminRoute>
        <ReleaseManagementPage />
      </AdminRoute>
    ),
  },
  {
    path: '/moderator',
    element: (
      <ModeratorRoute>
        <ModeratorPage />
      </ModeratorRoute>
    ),
  },
  {
    path: '/moderator/marketplace',
    element: (
      <ModeratorRoute>
        <MarketplaceModerationPage />
      </ModeratorRoute>
    ),
  },
  {
    path: '/moderator/forum',
    element: (
      <ModeratorRoute>
        <ForumModerationPage />
      </ModeratorRoute>
    ),
  },
  {
    path: '/community',
    element: <Navigate to="/community-hub?tab=community" replace />,
  },
  {
    path: '/community/category/:id',
    element: <CategoryPage />,
  },
  {
    path: '/community/thread/:id',
    element: <ThreadPage />,
  },
  {
    path: '/community/new-thread',
    element: (
      <ProtectedRoute>
        <NewThreadPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/shop',
    element: (
      <ProtectedRoute>
        <StorePage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/shop/purchases',
    element: (
      <ProtectedRoute>
        <PurchaseHistoryPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/avatar-builder',
    element: (
      <ProtectedRoute>
        <AvatarBuilderPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/studio',
    element: (
      <ProtectedRoute>
        <StudioPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/support',
    element: <SupportPage />,
  },
  {
    path: '/support/tickets/:id',
    element: (
      <ProtectedRoute>
        <TicketDetail />
      </ProtectedRoute>
    ),
  },
  {
    path: '/news',
    element: <NewsPage />,
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
  ],
  {
    future: {
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    },
  }
);



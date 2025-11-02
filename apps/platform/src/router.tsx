import { createBrowserRouter } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { MarketplacePage } from './pages/MarketplacePage';
import { MarketplaceItemPage } from './pages/MarketplaceItemPage';
import { ProfilePage } from './pages/ProfilePage';
import { MessagesPage } from './pages/MessagesPage';
import { EditorPage } from './pages/EditorPage';
import { PlayerPage } from './pages/PlayerPage';
import { FriendsPage } from './pages/FriendsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AdminPage } from './pages/AdminPage';
import { ModeratorPage } from './pages/ModeratorPage';
import { UsersManagementPage } from './pages/admin/UsersManagementPage';
import { StatsPage } from './pages/admin/StatsPage';
import { MarketplaceModerationPage as AdminMarketplacePage } from './pages/admin/MarketplaceModerationPage';
import { MarketplaceModerationPage } from './pages/moderator/MarketplaceModerationPage';
import { CommunityPage } from './pages/CommunityPage';
import { CategoryPage } from './pages/CategoryPage';
import { ThreadPage } from './pages/ThreadPage';
import { NewThreadPage } from './pages/NewThreadPage';
import { ShopPage } from './pages/ShopPage';
import { PurchaseHistoryPage } from './pages/PurchaseHistoryPage';
import { ShopManagementPage } from './pages/admin/ShopManagementPage';
import { ForumManagementPage } from './pages/admin/ForumManagementPage';
import { ForumModerationPage } from './pages/moderator/ForumModerationPage';
import { AvatarBuilderStudioPage } from './pages/AvatarBuilderStudioPage';
import { BlocksModelsStudioPage } from './pages/BlocksModelsStudioPage';
import { StudioPage } from './pages/StudioPage';
import { ProtectedRoute, AdminRoute, ModeratorRoute } from './components/auth/ProtectedRoute';

export const router: ReturnType<typeof createBrowserRouter> = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />,
  },
  {
    path: '/games',
    element: <HomePage />,
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
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <DashboardPage />
      </ProtectedRoute>
    ),
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
    element: (
      <ProtectedRoute>
        <PlayerPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/marketplace',
    element: <MarketplacePage />,
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
    path: '/messages',
    element: (
      <ProtectedRoute>
        <MessagesPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/friends',
    element: (
      <ProtectedRoute>
        <FriendsPage />
      </ProtectedRoute>
    ),
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
    element: <CommunityPage />,
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
        <ShopPage />
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
        <AvatarBuilderStudioPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/blocks-models-studio',
    element: (
      <ProtectedRoute>
        <BlocksModelsStudioPage />
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
]);


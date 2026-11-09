import { createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router-dom';
import Footer from './components/Footer';
import { ProtectedRoute } from './components/ProtectedRoute';
import { TopMenuBar } from './components/TopMenuBar';
import { EditItemPage } from './pages/EditItemPage';
import { HomePage } from './pages/Home.page';
import ItemDetailPage from './pages/ItemDetailPage';
import { ItemsPage } from './pages/ItemsPage';
import { NewItemPage } from './pages/NewItemPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { ProfilePage } from './pages/ProfilePage';
import { ItemType } from './utils/tagUtils';

// The gallery page of each item type
const itemTypePaths = {
  asset: '/assets',
  profile: '/profiles',
  recording: '/recordings',
  webpanel: '/webpanels',
  config: '/configs',
  showcomposer: '/showcomposers',
  package: '/packages',
} satisfies Record<ItemType, string>;

function Layout() {
  return (
    <>
      <TopMenuBar />
      <Outlet />
      <Footer />
    </>
  );
}

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/items', element: <ItemsPage type={null} /> },
      { path: '/items/new', element: <NewItemPage /> },
      { path: '/items/:id', element: <ItemDetailPage /> },
      {
        path: '/items/:id/edit',
        element: (
          <ProtectedRoute>
            <EditItemPage />
          </ProtectedRoute>
        ),
      },
      ...Object.entries(itemTypePaths).map(([type, path]) => ({
        path,
        // Keyed so going from one type's gallery to another's starts a new one
        element: <ItemsPage key={type} type={type as ItemType} />,
      })),
      { path: '/profile', element: <Navigate to="/profile/me" replace /> },
      { path: '/profile/:userId', element: <ProfilePage /> },
      { path: '/privacy', element: <PrivacyPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export function Router() {
  return <RouterProvider router={router} />;
}

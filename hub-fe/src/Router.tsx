import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
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

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <>
        <TopMenuBar />
        <HomePage />
        <Footer />
      </>
    ),
  },
  {
    path: '/items',
    // element: <ItemsPage />,
    children: [
      {
        index: true,
        element: (
          <>
            <TopMenuBar />
            <ItemsPage type={null} />
            <Footer />
          </>
        ),
      },
      {
        path: ':id',
        element: (
          <>
            <TopMenuBar />
            <ItemDetailPage /> <Footer />
          </>
        ),
      },
    ],
  },
  {
    path: '/assets',
    element: (
      <>
        <TopMenuBar />
        <ItemsPage type={'asset'} />
        <Footer />
      </>
    ),
  },
  {
    path: '/profiles',
    element: (
      <>
        <TopMenuBar />
        <ItemsPage type={'profile'} />
        <Footer />
      </>
    ),
  },
  {
    path: '/recordings',
    element: (
      <>
        <TopMenuBar />
        <ItemsPage type={'recording'} />
        <Footer />
      </>
    ),
  },
  {
    path: '/webpanels',
    element: (
      <>
        <TopMenuBar />
        <ItemsPage type={'webpanel'} />
        <Footer />
      </>
    ),
  },
  {
    path: '/configs',
    element: (
      <>
        <TopMenuBar />
        <ItemsPage type={'config'} />
        <Footer />
      </>
    ),
  },
  {
    path: '/showcomposers',
    element: (
      <>
        <TopMenuBar />
        <ItemsPage type={'showcomposer'} />
        <Footer />
      </>
    ),
  },
  {
    path: '/packages',
    element: (
      <>
        <TopMenuBar />
        <ItemsPage type={'package'} />
        <Footer />
      </>
    ),
  },
  {
    path: '/profile/:userId',
    element: (
      <>
        <TopMenuBar />
        <ProfilePage />
        <Footer />
      </>
    ),
  },
  {
    path: '/profile',
    element: <Navigate to="/profile/me" replace />,
  },
  {
    path: '/items/new',
    element: (
      <>
        <TopMenuBar />
        <NewItemPage />
        <Footer />
      </>
    ),
  },
  {
    path: '/items/:id/edit',
    element: (
      <>
        <TopMenuBar />
        <EditItemPage />
        <Footer />
      </>
    ),
  },
  {
    path: '/privacy',
    element: (
      <>
        <TopMenuBar />
        <PrivacyPage />
        <Footer />
      </>
    ),
  },
  {
    path: '*',
    element: (
      <>
        <TopMenuBar />
        <NotFoundPage />
        <Footer />
      </>
    ),
  },
]);

export function Router() {
  return <RouterProvider router={router} />;
}

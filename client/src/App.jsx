import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import PublicLayout from './layouts/PublicLayout';
import DashboardLayout from './layouts/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoute';
import { PageLoader } from './components/ui';

// Public
import Home from './pages/public/Home';
import Services from './pages/public/Services';
import ServiceDetail from './pages/public/ServiceDetail';
import HowItWorks from './pages/public/HowItWorks';
import BecomeTechnician from './pages/public/BecomeTechnician';
import Login from './pages/public/Login';
import Register from './pages/public/Register';
import TechnicianRegister from './pages/public/TechnicianRegister';
import NotFound from './pages/public/NotFound';

// Role areas are code-split so visitors to the homepage do not download dashboards / charts
const CustomerDashboard = lazy(() => import('./pages/customer/Dashboard'));
const BookRequest = lazy(() => import('./pages/customer/BookRequest'));
const MyRequests = lazy(() => import('./pages/customer/MyRequests'));
const RequestDetail = lazy(() => import('./pages/customer/RequestDetail'));
const History = lazy(() => import('./pages/customer/History'));
const Payments = lazy(() => import('./pages/customer/Payments'));
const Ratings = lazy(() => import('./pages/customer/Ratings'));
const Support = lazy(() => import('./pages/customer/Support'));
const Invoice = lazy(() => import('./pages/customer/Invoice'));
const Profile = lazy(() => import('./pages/shared/Profile'));

const TechDashboard = lazy(() => import('./pages/technician/Dashboard'));
const TechJobs = lazy(() => import('./pages/technician/Jobs'));
const TechJobDetail = lazy(() => import('./pages/technician/JobDetail'));
const TechProfile = lazy(() => import('./pages/technician/TechProfile'));
const TechAvailability = lazy(() => import('./pages/technician/Availability'));
const TechEarnings = lazy(() => import('./pages/technician/Earnings'));

const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminTechnicians = lazy(() => import('./pages/admin/Technicians'));
const AdminPending = lazy(() => import('./pages/admin/PendingTechnicians'));
const AdminTechnicianDetail = lazy(() => import('./pages/admin/TechnicianDetail'));
const AdminRequests = lazy(() => import('./pages/admin/Requests'));
const AdminRequestDetail = lazy(() => import('./pages/admin/RequestDetail'));
const AdminServices = lazy(() => import('./pages/admin/ServicesAdmin'));
const AdminPayments = lazy(() => import('./pages/admin/PaymentsAdmin'));
const AdminSupport = lazy(() => import('./pages/admin/SupportAdmin'));
const AdminAudit = lazy(() => import('./pages/admin/AuditLog'));
const AdminReviews = lazy(() => import('./pages/admin/Reviews'));
const AdminSettings = lazy(() => import('./pages/admin/SettingsAdmin'));

const guard = (roles, el) => <ProtectedRoute roles={roles}>{el}</ProtectedRoute>;

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/services" element={<Services />} />
          <Route path="/services/:id" element={<ServiceDetail />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/become-technician" element={<BecomeTechnician />} />
          <Route path="/login" element={<Login portal="CUSTOMER" />} />
          <Route path="/register" element={<Register />} />
          <Route path="/technician/login" element={<Login portal="TECHNICIAN" />} />
          <Route path="/technician/register" element={<TechnicianRegister />} />
          <Route path="/admin/login" element={<Login portal="ADMIN" />} />
        </Route>

        {/* Customer */}
        <Route element={guard(['CUSTOMER'], <DashboardLayout />)}>
          <Route path="/customer" element={<Navigate to="/customer/dashboard" replace />} />
          <Route path="/customer/dashboard" element={<CustomerDashboard />} />
          <Route path="/customer/request" element={<BookRequest />} />
          <Route path="/customer/requests" element={<MyRequests />} />
          <Route path="/customer/request/:id" element={<RequestDetail />} />
          <Route path="/customer/history" element={<History />} />
          <Route path="/customer/payment" element={<Payments />} />
          <Route path="/customer/invoice/:id" element={<Invoice />} />
          <Route path="/customer/rating" element={<Ratings />} />
          <Route path="/customer/support" element={<Support />} />
          <Route path="/customer/profile" element={<Profile />} />
        </Route>

        {/* Technician */}
        <Route element={guard(['TECHNICIAN'], <DashboardLayout />)}>
          <Route path="/technician" element={<Navigate to="/technician/dashboard" replace />} />
          <Route path="/technician/dashboard" element={<TechDashboard />} />
          <Route path="/technician/jobs" element={<TechJobs />} />
          <Route path="/technician/jobs/:id" element={<TechJobDetail />} />
          <Route path="/technician/profile" element={<TechProfile />} />
          <Route path="/technician/availability" element={<TechAvailability />} />
          <Route path="/technician/earnings" element={<TechEarnings />} />
        </Route>

        {/* Admin */}
        <Route element={guard(['ADMIN'], <DashboardLayout />)}>
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/technicians" element={<AdminTechnicians />} />
          <Route path="/admin/technicians/pending" element={<AdminPending />} />
          <Route path="/admin/technicians/:id" element={<AdminTechnicianDetail />} />
          <Route path="/admin/requests" element={<AdminRequests />} />
          <Route path="/admin/requests/:id" element={<AdminRequestDetail />} />
          <Route path="/admin/services" element={<AdminServices />} />
          <Route path="/admin/reviews" element={<AdminReviews />} />
          <Route path="/admin/payments" element={<AdminPayments />} />
          <Route path="/admin/support" element={<AdminSupport />} />
          <Route path="/admin/audit" element={<AdminAudit />} />
          <Route path="/admin/settings" element={<AdminSettings />} />
        </Route>

        <Route element={<PublicLayout />}><Route path="*" element={<NotFound />} /></Route>
      </Routes>
    </Suspense>
  );
}

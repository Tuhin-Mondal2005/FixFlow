import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="container-app flex flex-col items-center py-24 text-center">
      <div className="text-7xl" aria-hidden="true">🛠️</div>
      <h1 className="page-title mt-4">Page not found</h1>
      <p className="mt-2 text-ink-500">The page you are looking for does not exist or has moved.</p>
      <Link to="/" className="btn-primary mt-6">Back to home</Link>
    </div>
  );
}

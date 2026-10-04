import { Link } from 'react-router-dom';
import { Card } from '../components/ui';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg py-16 animate-fade-up">
      <Card>
        <div className="flex flex-col items-center py-8 text-center">
          <Compass size={40} className="mb-4 text-white/20" />
          <h1 className="font-display text-display-md text-white">Page not found</h1>
          <p className="mt-2 text-sm text-white/45">
            That route doesn&rsquo;t exist in this app.
          </p>
          <Link to="/" className="btn-primary mt-6">
            Back to home
          </Link>
        </div>
      </Card>
    </div>
  );
}

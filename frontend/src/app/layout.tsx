import { AuthProvider } from '../context/auth-context';
import './globals.css';

export const metadata = {
  title: 'Rebate System',
  description: 'Manual QA MVP for Rebate System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

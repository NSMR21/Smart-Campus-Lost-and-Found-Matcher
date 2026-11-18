import './globals.css';

export const metadata = {
  title: 'Campus Lost & Found',
  description: 'Smart Campus Lost & Found Management and Matching System',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

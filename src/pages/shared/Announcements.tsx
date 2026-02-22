import { Layout } from '../../components/layout/Layout';
import { useAuth } from '../../lib/AuthContext';
import { getAnnouncementsForRole } from '../../services/announcements';
import { useUnreadAnnouncements } from '../../hooks/useUnreadAnnouncements';
import { Bell, Calendar as CalendarIcon } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { useState, useEffect } from 'react';
import type { Announcement } from '../../types';

export function Announcements() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const { markAllRead } = useUnreadAnnouncements(user);

  useEffect(() => {
    if (!user) return;
    getAnnouncementsForRole(user.role)
      .then(setAnnouncements)
      .finally(() => setLoading(false));
  }, [user]);

  // Mark all announcements as read whenever this page is opened
  useEffect(() => {
    if (!loading) markAllRead();
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredAnnouncements = announcements;

  if (!user) return null;
  if (loading) return <Layout user={user} pageTitle="Announcements"><div className="p-6">Loading announcements...</div></Layout>;

  return (
    <Layout user={user} pageTitle="Announcements">
      <div className="mb-6">
        <p className="text-[var(--color-text-600)]">
          Stay updated with the latest announcements and important information
        </p>
      </div>

      <div className="space-y-4">
        {filteredAnnouncements.length > 0 ? (
          filteredAnnouncements.map((announcement) => (
            <Card key={announcement.id} className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-[var(--color-primary-100)] rounded-lg">
                  <Bell className="w-6 h-6 text-[var(--color-primary-700)]" />
                </div>
                <div className="flex-1">
                  <h2 className="text-[var(--color-text-900)] mb-2">
                    {announcement.title}
                  </h2>
                  <p className="text-[var(--color-text-700)] mb-4 whitespace-pre-line">
                    {announcement.content}
                  </p>
                  <div className="flex items-center gap-4 text-[var(--color-text-600)]">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4" />
                      <span>
                        {new Date(announcement.publishedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <span>•</span>
                    <span>Posted by {announcement.author}</span>
                  </div>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <Card className="p-12">
            <div className="text-center">
              <Bell className="w-16 h-16 mx-auto mb-4 text-[var(--color-text-400)]" />
              <h3 className="text-[var(--color-text-900)] mb-2">No announcements</h3>
              <p className="text-[var(--color-text-600)]">
                There are no announcements at this time. Check back later for updates.
              </p>
            </div>
          </Card>
        )}
      </div>
    </Layout>
  );
}

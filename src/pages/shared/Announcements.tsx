import { Layout } from '../../components/layout/Layout';
import { mockUsers, mockAnnouncements } from '../../lib/mock-data';
import { Bell, Calendar as CalendarIcon } from 'lucide-react';
import { Card } from '../../components/ui/card';

interface AnnouncementsProps {
  userRole: 'student' | 'supervisor' | 'admin';
}

export function Announcements({ userRole }: AnnouncementsProps) {
  const user = mockUsers[userRole];

  // Filter announcements based on user role
  const filteredAnnouncements = mockAnnouncements.filter(announcement =>
    announcement.targetRoles.includes(userRole)
  );

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

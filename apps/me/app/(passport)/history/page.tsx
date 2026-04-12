import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';

export default async function HistoryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const activities = await prisma.userActivity.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      action: true,
      targetType: true,
      metadata: true,
      createdAt: true,
    },
  });

  const ACTION_LABELS: Record<string, string> = {
    geo_checkin: 'Checked in at a store',
    store_checkin: 'Store check-in',
    store_event_attendance: 'Attended a store event',
    tournament_result: 'Tournament result',
    game_night_rsvp: 'RSVP to a game night',
    purchase: 'Purchase',
  };

  return (
    <div>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#FF8200', marginBottom: '0.5rem' }}>
        History
      </h1>
      <p style={{ color: '#9ca3af', marginBottom: '2rem' }}>
        Check-ins, events, tournaments, and activity across the Afterroar network.
      </p>

      {activities.length === 0 ? (
        <div style={{
          padding: '3rem',
          background: '#1f2937',
          borderRadius: '12px',
          textAlign: 'center',
        }}>
          <p style={{ color: '#6b7280', fontSize: '1.1rem', margin: '0 0 0.5rem 0' }}>
            No activity yet
          </p>
          <p style={{ color: '#4b5563', fontSize: '0.85rem', margin: 0 }}>
            Check-ins, event attendance, and tournament results will appear here
            as you participate across the Afterroar network.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {activities.map((activity) => {
            let meta: Record<string, unknown> = {};
            try {
              meta = activity.metadata ? JSON.parse(activity.metadata) : {};
            } catch { /* ignore */ }

            return (
              <div key={activity.id} style={{
                padding: '1rem 1.25rem',
                background: '#1f2937',
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}>
                <div>
                  <p style={{ color: '#e2e8f0', margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>
                    {ACTION_LABELS[activity.action] || activity.action}
                  </p>
                  {typeof meta.venueName === 'string' ? (
                    <p style={{ color: '#9ca3af', margin: '0.2rem 0 0 0', fontSize: '0.8rem' }}>
                      at {meta.venueName}
                    </p>
                  ) : null}
                  {typeof meta.eventName === 'string' ? (
                    <p style={{ color: '#9ca3af', margin: '0.2rem 0 0 0', fontSize: '0.8rem' }}>
                      {meta.eventName}
                    </p>
                  ) : null}
                  {meta.record != null && typeof meta.record === 'object' ? (
                    <p style={{ color: '#9ca3af', margin: '0.2rem 0 0 0', fontSize: '0.8rem' }}>
                      Record: {(meta.record as { wins: number }).wins}W-{(meta.record as { losses: number }).losses}L
                    </p>
                  ) : null}
                </div>
                <span style={{ color: '#6b7280', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                  {activity.createdAt.toLocaleDateString()}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

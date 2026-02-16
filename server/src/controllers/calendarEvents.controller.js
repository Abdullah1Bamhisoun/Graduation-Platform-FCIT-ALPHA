const { supabaseAdmin } = require('../config/supabase');

/**
 * GET /api/calendar-events
 * Authenticated — returns all calendar events
 */
async function listEvents(req, res) {
  try {
    const { data, error } = await supabaseAdmin
      .from('calendar_events')
      .select('id, title, date, type, time, location, created_at')
      .order('date', { ascending: true });

    if (error) throw error;

    res.json((data || []).map((e) => ({
      id: e.id,
      title: e.title,
      date: e.date,
      type: e.type,
      time: e.time ?? undefined,
      location: e.location ?? undefined,
    })));
  } catch (error) {
    console.error('Error listing calendar events:', error);
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
}

/**
 * POST /api/calendar-events
 * Admin only — create a new calendar event
 */
async function createEvent(req, res) {
  try {
    const { title, date, type, time, location } = req.body;

    if (!title || !date || !type) {
      return res.status(400).json({ error: 'title, date, and type are required' });
    }

    const { data, error } = await supabaseAdmin
      .from('calendar_events')
      .insert({
        title,
        date,
        type,
        time: time || null,
        location: location || null,
      })
      .select('id')
      .single();

    if (error) throw error;

    res.json({ success: true, id: data.id });
  } catch (error) {
    console.error('Error creating calendar event:', error);
    res.status(500).json({ error: 'Failed to create calendar event' });
  }
}

/**
 * DELETE /api/calendar-events/:id
 * Admin only — delete a calendar event
 */
async function deleteEvent(req, res) {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from('calendar_events').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    res.status(500).json({ error: 'Failed to delete calendar event' });
  }
}

module.exports = { listEvents, createEvent, deleteEvent };

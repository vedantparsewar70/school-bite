import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { getCurrentUser } from '@/lib/auth';
import { cleanDoc, generateId } from '@/lib/firestore-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const snap = await db.collection('teacher_meals').get();
    const meals = snap.docs
      .map((d) => d.data())
      .sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));

    return NextResponse.json({ meals });
  } catch (error) {
    console.error('Error fetching staff teacher meals:', error);
    return NextResponse.json({ error: 'Failed to fetch teacher meals' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { name, price, category = 'LUNCH', isVegetarian = true, description } = body;

    const cleanName = (name || '').trim();
    const numPrice = parseFloat(price);

    if (!cleanName || isNaN(numPrice) || numPrice <= 0) {
      return NextResponse.json({ error: 'Valid name and price (> 0) are required' }, { status: 400 });
    }

    const id = generateId('TM-');
    const now = new Date().toISOString();
    const meal = cleanDoc({
      id,
      name: cleanName,
      description: (description || '').trim() || `${cleanName} - Freshly prepared for staff and teachers`,
      category: (category || 'LUNCH').toUpperCase().trim(),
      price: numPrice,
      isVegetarian: Boolean(isVegetarian),
      isAvailable: true,
      createdAt: now,
      updatedAt: now,
    });

    await db.collection('teacher_meals').doc(id).set(meal);

    try {
      const { notifyTeacherOrdersUpdated } = await import('@/lib/sync-events');
      await notifyTeacherOrdersUpdated();
    } catch {
      // non-blocking
    }

    return NextResponse.json({ success: true, meal }, { status: 201 });
  } catch (error) {
    console.error('Error creating teacher meal:', error);
    return NextResponse.json({ error: 'Failed to create teacher meal' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { id, name, price, category, isVegetarian, description, isAvailable } = body;

    if (!id) {
      return NextResponse.json({ error: 'Meal ID is required' }, { status: 400 });
    }

    const ref = db.collection('teacher_meals').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Meal not found' }, { status: 404 });
    }

    const updates: any = { updatedAt: new Date().toISOString() };
    if (name) updates.name = name.trim();
    if (price !== undefined && !isNaN(parseFloat(price))) updates.price = parseFloat(price);
    if (category) updates.category = category.toUpperCase().trim();
    if (isVegetarian !== undefined) updates.isVegetarian = Boolean(isVegetarian);
    if (description !== undefined) updates.description = description.trim();
    if (isAvailable !== undefined) updates.isAvailable = Boolean(isAvailable);

    await ref.update(cleanDoc(updates));

    const updatedSnap = await ref.get();

    try {
      const { notifyTeacherOrdersUpdated } = await import('@/lib/sync-events');
      await notifyTeacherOrdersUpdated();
    } catch {
      // non-blocking
    }

    return NextResponse.json({ success: true, meal: updatedSnap.data() });
  } catch (error) {
    console.error('Error updating teacher meal:', error);
    return NextResponse.json({ error: 'Failed to update teacher meal' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { id, isAvailable } = body;

    if (!id || isAvailable === undefined) {
      return NextResponse.json({ error: 'id and isAvailable are required' }, { status: 400 });
    }

    const ref = db.collection('teacher_meals').doc(id);
    await ref.update({
      isAvailable: Boolean(isAvailable),
      updatedAt: new Date().toISOString(),
    });

    try {
      const { notifyTeacherOrdersUpdated } = await import('@/lib/sync-events');
      await notifyTeacherOrdersUpdated();
    } catch {
      // non-blocking
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error toggling teacher meal availability:', error);
    return NextResponse.json({ error: 'Failed to toggle availability' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    await db.collection('teacher_meals').doc(id).delete();

    try {
      const { notifyTeacherOrdersUpdated } = await import('@/lib/sync-events');
      await notifyTeacherOrdersUpdated();
    } catch {
      // non-blocking
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting teacher meal:', error);
    return NextResponse.json({ error: 'Failed to delete teacher meal' }, { status: 500 });
  }
}

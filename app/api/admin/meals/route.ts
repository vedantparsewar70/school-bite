import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const meals = await prisma.meal.findMany({
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({ meals });
  } catch (error) {
    console.error('Error fetching meals:', error);
    return NextResponse.json({ error: 'Failed to fetch meals' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const {
      name,
      description,
      category = 'LUNCH',
      isVegetarian = true,
      ingredients,
      allergens,
      calories,
      price,
      imageUrl,
    } = body;

    if (!name || !description || price === undefined) {
      return NextResponse.json(
        { error: 'Name, description, and price are required' },
        { status: 400 }
      );
    }

    const meal = await prisma.meal.create({
      data: {
        name: name.trim(),
        description: description.trim(),
        category,
        isVegetarian: Boolean(isVegetarian),
        ingredients: ingredients?.trim() || null,
        allergens: allergens?.trim() || null,
        calories: calories ? Number(calories) : null,
        price: Number(price),
        imageUrl: imageUrl?.trim() || 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&auto=format&fit=crop&q=80',
      },
    });

    return NextResponse.json({ success: true, meal }, { status: 201 });
  } catch (error) {
    console.error('Error creating meal:', error);
    return NextResponse.json({ error: 'Failed to create meal' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const {
      id,
      name,
      description,
      category,
      isVegetarian,
      ingredients,
      allergens,
      calories,
      price,
      imageUrl,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'Meal ID is required' }, { status: 400 });
    }

    const updated = await prisma.meal.update({
      where: { id },
      data: {
        name: name !== undefined ? name.trim() : undefined,
        description: description !== undefined ? description.trim() : undefined,
        category: category !== undefined ? category : undefined,
        isVegetarian: isVegetarian !== undefined ? Boolean(isVegetarian) : undefined,
        ingredients: ingredients !== undefined ? ingredients?.trim() || null : undefined,
        allergens: allergens !== undefined ? allergens?.trim() || null : undefined,
        calories: calories !== undefined ? (calories ? Number(calories) : null) : undefined,
        price: price !== undefined ? Number(price) : undefined,
        imageUrl: imageUrl !== undefined ? imageUrl?.trim() || null : undefined,
      },
    });

    return NextResponse.json({ success: true, meal: updated });
  } catch (error) {
    console.error('Error updating meal:', error);
    return NextResponse.json({ error: 'Failed to update meal' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Meal ID is required' }, { status: 400 });
    }

    // Check if meal is in active orders
    const count = await prisma.orderItem.count({ where: { mealId: id } });
    if (count > 0) {
      return NextResponse.json(
        { error: 'Cannot delete meal because it has existing orders in the system. You can remove it from future daily menus instead.' },
        { status: 400 }
      );
    }

    await prisma.meal.delete({ where: { id } });
    return NextResponse.json({ success: true, message: 'Meal deleted successfully' });
  } catch (error) {
    console.error('Error deleting meal:', error);
    return NextResponse.json({ error: 'Failed to delete meal' }, { status: 500 });
  }
}

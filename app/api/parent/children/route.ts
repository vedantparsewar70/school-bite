import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'PARENT' || !user.parentId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const students = await prisma.student.findMany({
      where: {
        parentId: user.parentId,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ students });
  } catch (error) {
    console.error('Error fetching children:', error);
    return NextResponse.json({ error: 'Failed to fetch children' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'PARENT' || !user.parentId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();
    const { name, dob, grade, division, rollNo, studentId, allergies, isVegetarian, profilePhoto } = data;

    if (!name || !grade || !division || !rollNo) {
      return NextResponse.json(
        { error: 'Name, Class, Division, and Roll Number are required' },
        { status: 400 }
      );
    }

    const generatedStudentId = studentId?.trim() || `STU-2026-${Math.floor(100 + Math.random() * 900)}`;

    const newStudent = await prisma.student.create({
      data: {
        parentId: user.parentId,
        name: name.trim(),
        dob: dob || null,
        grade: String(grade).trim(),
        division: String(division).trim().toUpperCase(),
        rollNo: String(rollNo).trim(),
        studentId: generatedStudentId,
        allergies: allergies ? String(allergies).trim() : null,
        isVegetarian: isVegetarian !== false,
        profilePhoto: profilePhoto || null,
        isActive: true,
      },
    });

    return NextResponse.json({ success: true, student: newStudent }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating child:', error);
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'A student with this ID already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create student' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'PARENT' || !user.parentId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();
    const { id, name, dob, grade, division, rollNo, allergies, isVegetarian, profilePhoto } = data;

    if (!id) {
      return NextResponse.json({ error: 'Student ID is required' }, { status: 400 });
    }

    // Verify ownership
    const student = await prisma.student.findFirst({
      where: { id, parentId: user.parentId },
    });

    if (!student) {
      return NextResponse.json({ error: 'Student not found or unauthorized' }, { status: 404 });
    }

    const updated = await prisma.student.update({
      where: { id },
      data: {
        name: name?.trim() ?? student.name,
        dob: dob ?? student.dob,
        grade: grade ? String(grade).trim() : student.grade,
        division: division ? String(division).trim().toUpperCase() : student.division,
        rollNo: rollNo ? String(rollNo).trim() : student.rollNo,
        allergies: allergies !== undefined ? allergies : student.allergies,
        isVegetarian: isVegetarian !== undefined ? isVegetarian : student.isVegetarian,
        profilePhoto: profilePhoto !== undefined ? profilePhoto : student.profilePhoto,
      },
    });

    return NextResponse.json({ success: true, student: updated });
  } catch (error) {
    console.error('Error updating child:', error);
    return NextResponse.json({ error: 'Failed to update student' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'PARENT' || !user.parentId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Student ID is required' }, { status: 400 });
    }

    // Verify ownership
    const student = await prisma.student.findFirst({
      where: { id, parentId: user.parentId },
    });

    if (!student) {
      return NextResponse.json({ error: 'Student not found or unauthorized' }, { status: 404 });
    }

    // Soft delete/deactivate so historical orders are preserved
    await prisma.student.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true, message: 'Student removed successfully' });
  } catch (error) {
    console.error('Error deleting child:', error);
    return NextResponse.json({ error: 'Failed to delete student' }, { status: 500 });
  }
}

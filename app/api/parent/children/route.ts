import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/firebase-admin';
import { BUSINESS_CONFIG } from '@/lib/business-config';
import { getTodayString } from '@/lib/utils';
import { serviceStatusFor } from '@/lib/service-dates';

/** True when the child has a paid, not-cancelled meal today or later that has not been handed over. */
async function hasUpcomingPaidMeals(studentId: string): Promise<boolean> {
  const today = getTodayString();
  const itemsSnap = await db.collection('orderItems').where('studentId', '==', studentId).get();
  const upcoming = itemsSnap.docs.map((d) => d.data()).filter((it) => typeof it.date === 'string' && it.date >= today);
  const orderIds = Array.from(new Set(upcoming.map((it) => String(it.orderId))));
  if (orderIds.length === 0) return false;
  const orders = await db.getAll(...orderIds.map((oid) => db.collection('orders').doc(oid)));
  const byId = new Map(orders.filter((o) => o.exists).map((o) => [o.id, o.data() || {}]));
  return upcoming.some((it) => {
    const order = byId.get(String(it.orderId));
    if (!order || order.paymentStatus !== 'PAID') return false;
    const status = serviceStatusFor(order as any, it.date);
    return status !== 'CANCELLED' && status !== 'COLLECTED';
  });
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user || user.role !== 'PARENT' || !user.parentId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const students = await prisma.student.findMany({
      where: {
        parentId: user.parentId,
        isActive: true,
      },
      include: {
        studentAllergies: {
          include: { allergy: true },
        },
        orderItems: {
          where: {
            hasAllergyAlert: true,
          },
          select: { id: true, hasAllergyAlert: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formattedStudents = students.map((s) => {
      const allergiesList = s.studentAllergies.map((sa) => sa.allergy.name);
      if (s.allergies && allergiesList.length === 0) {
        s.allergies.split(/[,;]/).forEach((p) => {
          const t = p.trim();
          if (t && !allergiesList.includes(t)) allergiesList.push(t);
        });
      }

      let allergyAlertStatus: 'NO_ALLERGY' | 'ALLERGY_RECORDED' | 'CONFLICT_DETECTED' = 'NO_ALLERGY';
      // Only lines flagged with an allergy alert are conflicts (the adapter ignores the include's `where`).
      if ((s.orderItems || []).some((it: any) => it.hasAllergyAlert === true)) {
        allergyAlertStatus = 'CONFLICT_DETECTED';
      } else if (allergiesList.length > 0 && !allergiesList.includes('None')) {
        allergyAlertStatus = 'ALLERGY_RECORDED';
      }

      const resolvedGrade = s.grade || '';
      const category =
        (s as any).studentCategory ||
        (resolvedGrade.toLowerCase().includes('nursery') ||
        resolvedGrade.toLowerCase().includes('kg') ||
        resolvedGrade.toLowerCase().includes('pre')
          ? 'Pre-primary'
          : parseInt(resolvedGrade, 10) <= 5
          ? 'Primary'
          : 'Secondary');

      return {
        id: s.id,
        parentId: s.parentId,
        name: s.name,
        dob: s.dob,
        grade: s.grade,
        division: s.division,
        rollNo: s.rollNo,
        studentId: s.studentId,
        studentCategory: category,
        allergies: allergiesList.join(', ') || s.allergies || null,
        allergiesList,
        dietaryRestrictions: s.dietaryRestrictions || null,
        foodPreference: s.foodPreference || null,
        notes: s.notes || null,
        isVegetarian: s.isVegetarian,
        profilePhoto: null, // Photos completely removed
        isActive: s.isActive,
        allergyAlertStatus,
      };
    });

    return NextResponse.json({ students: formattedStudents });
  } catch (error) {
    console.error('Error fetching children:', error);
    return NextResponse.json({ error: 'Failed to fetch children' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user || user.role !== 'PARENT' || !user.parentId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();
    const {
      name,
      dob,
      grade,
      division,
      rollNo,
      studentId,
      allergies, // can be string or array
      allergiesList,
      otherAllergy,
      dietaryRestrictions,
      foodPreference,
      notes,
      isVegetarian,
    } = data;

    const rawCategory = data.category || data.studentCategory || grade;
    let studentCategory: 'Pre-primary' | 'Primary' | 'Secondary' | null = null;
    if (rawCategory) {
      const clean = String(rawCategory).trim().toLowerCase();
      if (clean.includes('pre') || clean.includes('nursery') || clean.includes('kg')) {
        studentCategory = 'Pre-primary';
      } else if (clean.includes('sec') || parseInt(clean.replace(/\D/g, '') || '0', 10) > 5) {
        studentCategory = 'Secondary';
      } else {
        studentCategory = 'Primary';
      }
    }

    if (!name || !String(name).trim()) {
      return NextResponse.json(
        { error: 'Student full name is required' },
        { status: 400 }
      );
    }

    if (!studentCategory) {
      return NextResponse.json(
        { error: 'Class / Category is required (Pre-primary, Primary, or Secondary)' },
        { status: 400 }
      );
    }

    const generatedStudentId = studentId?.trim() || `STU-2026-${Math.floor(100 + Math.random() * 900)}`;

    // Build unified allergies array
    let finalAllergies: string[] = [];
    if (Array.isArray(allergiesList)) {
      finalAllergies = [...allergiesList];
    } else if (typeof allergies === 'string' && allergies.trim()) {
      finalAllergies = allergies.split(/[,;]/).map((a: string) => a.trim()).filter(Boolean);
    }
    if (otherAllergy && otherAllergy.trim() && !finalAllergies.includes(otherAllergy.trim())) {
      finalAllergies.push(otherAllergy.trim());
    }

    const allergiesSummary = finalAllergies.join(', ');
    const resolvedGrade = studentCategory;
    const resolvedDivision = division ? String(division).trim().toUpperCase() : '-';
    const resolvedRollNo = rollNo ? String(rollNo).trim() : '-';

    const newStudent = await prisma.student.create({
      data: {
        parentId: user.parentId,
        name: String(name).trim(),
        dob: dob ? String(dob).trim() : null,
        grade: resolvedGrade,
        division: resolvedDivision,
        rollNo: resolvedRollNo,
        studentId: generatedStudentId,
        studentCategory,
        allergies: allergiesSummary || null,
        dietaryRestrictions: dietaryRestrictions?.trim() || null,
        foodPreference: foodPreference?.trim() || (isVegetarian !== false ? 'Vegetarian' : 'Non-Vegetarian'),
        notes: notes?.trim() || null,
        isVegetarian: isVegetarian !== false,
        profilePhoto: null,
        isActive: true,
      },
    });

    // Create relational student allergies concurrently
    const validAllergies = finalAllergies.filter(
      (alg) => Boolean(alg) && alg.toLowerCase() !== 'none'
    );
    if (validAllergies.length > 0) {
      await Promise.all(
        validAllergies.map(async (alg) => {
          const allergyRecord = await prisma.allergy.upsert({
            where: { name: alg },
            update: {},
            create: { name: alg },
          });

          await prisma.studentAllergy.upsert({
            where: {
              studentId_allergyId: {
                studentId: newStudent.id,
                allergyId: allergyRecord.id,
              },
            },
            update: {},
            create: {
              studentId: newStudent.id,
              allergyId: allergyRecord.id,
            },
          });
        })
      );
    }

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
    const user = await getCurrentUser(req);
    if (!user || user.role !== 'PARENT' || !user.parentId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();
    const {
      id,
      name,
      dob,
      grade,
      division,
      rollNo,
      allergies,
      allergiesList,
      otherAllergy,
      dietaryRestrictions,
      foodPreference,
      notes,
      isVegetarian,
    } = data;

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

    if (name !== undefined && !String(name ?? '').trim()) {
      return NextResponse.json({ error: 'Student name cannot be empty' }, { status: 400 });
    }

    // Allergies are only replaced when the request includes them. The parent edit form does not
    // send them, so an ordinary name or class edit must keep the allergies the school recorded.
    const allergiesProvided = allergies !== undefined || allergiesList !== undefined || otherAllergy !== undefined;

    // Build unified allergies list
    let finalAllergies: string[] = [];
    if (Array.isArray(allergiesList)) {
      finalAllergies = [...allergiesList];
    } else if (typeof allergies === 'string') {
      finalAllergies = allergies.split(/[,;]/).map((a: string) => a.trim()).filter(Boolean);
    }
    if (otherAllergy && otherAllergy.trim() && !finalAllergies.includes(otherAllergy.trim())) {
      finalAllergies.push(otherAllergy.trim());
    }

    const allergiesSummary = finalAllergies.join(', ');

    const rawCategory = data.category || data.studentCategory || grade;
    let studentCategory: 'Pre-primary' | 'Primary' | 'Secondary' | null = null;
    if (rawCategory) {
      const clean = String(rawCategory).trim().toLowerCase();
      if (clean.includes('pre') || clean.includes('nursery') || clean.includes('kg')) {
        studentCategory = 'Pre-primary';
      } else if (clean.includes('sec') || parseInt(clean.replace(/\D/g, '') || '0', 10) > 5) {
        studentCategory = 'Secondary';
      } else {
        studentCategory = 'Primary';
      }
    }

    // The edit form sends the category word ("Primary") as `grade`. That must never overwrite a
    // real class the school recorded ("3"); it only replaces a grade that is empty or is itself a
    // category word. A real class value sent explicitly is saved.
    const isCategoryWord = (v: unknown) => /^(pre-?primary|primary|secondary)$/i.test(String(v ?? '').trim());
    const sentGrade = grade !== undefined && grade !== null && String(grade).trim() ? String(grade).trim() : '';
    const nextGrade =
      sentGrade && !isCategoryWord(sentGrade)
        ? sentGrade
        : !student.grade || isCategoryWord(student.grade)
          ? studentCategory || student.grade
          : student.grade;

    const updated = await prisma.student.update({
      where: { id },
      data: {
        name: name?.trim() ?? student.name,
        dob: dob !== undefined ? (dob ? String(dob).trim() : null) : student.dob,
        grade: nextGrade,
        division: division ? String(division).trim().toUpperCase() : student.division,
        rollNo: rollNo ? String(rollNo).trim() : student.rollNo,
        studentCategory: studentCategory || (student as any).studentCategory || 'Primary',
        allergies: allergiesProvided ? allergiesSummary || null : student.allergies,
        dietaryRestrictions: dietaryRestrictions !== undefined ? dietaryRestrictions?.trim() : student.dietaryRestrictions,
        foodPreference: foodPreference !== undefined ? foodPreference?.trim() : student.foodPreference,
        notes: notes !== undefined ? notes?.trim() : student.notes,
        isVegetarian: isVegetarian !== undefined ? isVegetarian : student.isVegetarian,
        profilePhoto: null,
      },
    });

    // Reset and sync student_allergies relation concurrently
    if (allergiesProvided) await prisma.studentAllergy.deleteMany({ where: { studentId: id } });
    const validUpdateAllergies = finalAllergies.filter(
      (alg) => Boolean(alg) && alg.toLowerCase() !== 'none'
    );
    if (allergiesProvided && validUpdateAllergies.length > 0) {
      await Promise.all(
        validUpdateAllergies.map(async (alg) => {
          const allergyRecord = await prisma.allergy.upsert({
            where: { name: alg },
            update: {},
            create: { name: alg },
          });

          await prisma.studentAllergy.create({
            data: {
              studentId: id,
              allergyId: allergyRecord.id,
            },
          });
        })
      );
    }

    return NextResponse.json({ success: true, student: updated });
  } catch (error) {
    console.error('Error updating child:', error);
    return NextResponse.json({ error: 'Failed to update student' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser(req);
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

    // A child with meals still to be served cannot be removed here: the canteen would keep
    // preparing them and nothing would be refunded. Cancellations go through the canteen.
    if (await hasUpcomingPaidMeals(id)) {
      return NextResponse.json(
        { error: `This child has upcoming paid meals. Please contact the canteen at ${BUSINESS_CONFIG.cancellationContactPhone}.`, code: 'HAS_UPCOMING_MEALS' },
        { status: 409 }
      );
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

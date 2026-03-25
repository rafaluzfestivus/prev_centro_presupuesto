import { NextResponse } from 'next/server'
import { getInstanceStatus } from '@/lib/evolution'

export async function GET() {
    const status = await getInstanceStatus()
    return NextResponse.json(status)
}

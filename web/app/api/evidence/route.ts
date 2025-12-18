import { NextRequest, NextResponse } from 'next/server';

// Evidence submission API endpoint
// Handles file uploads and forwards to IPFS

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const marketId = formData.get('marketId') as string | null;
        const description = formData.get('description') as string | null;
        const submitter = formData.get('submitter') as string | null;

        if (!file) {
            return NextResponse.json(
                { error: 'No file provided' },
                { status: 400 }
            );
        }

        if (!marketId) {
            return NextResponse.json(
                { error: 'Market ID is required' },
                { status: 400 }
            );
        }

        // Read file content
        const fileBuffer = await file.arrayBuffer();
        // FileBuffer available for future IPFS upload implementation
        void fileBuffer;

        // In production, this would:
        // 1. Upload to IPFS via nft.storage
        // 2. Call the submit_evidence instruction on-chain
        // 3. Notify the agent service

        // For now, generate a mock CID
        const mockCid = `bafkrei${Date.now().toString(36)}${Math.random().toString(36).substring(2, 10)}`;

        // Notify agent service about new evidence (if running)
        try {
            await fetch('http://localhost:3001/evidence', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    marketId,
                    evidenceCid: mockCid,
                    description,
                    submitter,
                    filename: file.name,
                    mimeType: file.type,
                    size: file.size,
                }),
            });
        } catch {
            // Agent might not be running - that's okay
            console.log('Agent notification skipped (service may not be running)');
        }

        return NextResponse.json({
            success: true,
            cid: mockCid,
            ipfsUrl: `https://ipfs.io/ipfs/${mockCid}`,
            message: 'Evidence submitted successfully',
            details: {
                marketId,
                filename: file.name,
                size: file.size,
                mimeType: file.type,
            },
        });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to upload evidence';
        console.error('Evidence upload error:', error);
        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}

export async function GET() {
    return NextResponse.json({
        message: 'Evidence API',
        endpoints: {
            'POST /api/evidence': 'Submit evidence for a market',
        },
        requiredFields: {
            file: 'File (multipart/form-data)',
            marketId: 'Market ID string',
            description: 'Optional description',
            submitter: 'Optional submitter wallet address',
        },
    });
}

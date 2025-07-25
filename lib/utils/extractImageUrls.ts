// Helper function to validate image URLs
function isValidImageUrl(url: string): boolean {
    try {
        const parsedUrl = new URL(url);
        // Check if it's a valid protocol
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            return false;
        }
        
        // Check if it's a valid image extension or IPFS URL
        const pathname = parsedUrl.pathname.toLowerCase();
        const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
        const hasValidExtension = validExtensions.some(ext => pathname.endsWith(ext));
        const isIpfsUrl = url.includes('ipfs') || url.includes('bafy');
        
        // For IPFS URLs, check if they have a filename parameter with extension
        if (isIpfsUrl) {
            // Check if URL has a filename parameter with valid extension
            const filenameMatch = url.match(/[?&]filename=.*\.(jpg|jpeg|png|gif|webp|svg|bmp)/i);
            if (filenameMatch) {
                return true;
            }
            // Also allow IPFS URLs without filename parameter (for backward compatibility)
            return true;
        }
        
        return hasValidExtension;
    } catch {
        return false;
    }
}

export function extractImageUrls(markdown: string): string[] {
    const imageRegex = /!\[.*?\]\((.*?)\)/g;

    const matches: string[] = [];
    let match;

    while ((match = imageRegex.exec(markdown)) !== null) {
        const url = match[1];
        // Only add valid image URLs
        if (isValidImageUrl(url)) {
            matches.push(url);
        }
    }

    return matches;
}

export interface LinkWithDomain {
    url: string
    domain: string
}

export function extractCustomLinks(inputText: string): LinkWithDomain[] {
    const customLinkRegex = /https:\/\/3speak\.tv\/watch\?v=[\w\d\-\/]+/gi
    const customLinks = inputText.match(customLinkRegex) || []

    const customLinkSet = new Set<string>()
    const customLinksWithDomains: LinkWithDomain[] = []

    for (const link of customLinks) {
        if (!customLinkSet.has(link)) {
            customLinkSet.add(link)
            const parsedUrl = new URL(link)
            const domain = parsedUrl.hostname || ""
            customLinksWithDomains.push({
                url: link.replace("watch", "embed"),
                domain,
            })
        }
    }

    return customLinksWithDomains
}

// Add new function to extract YouTube links
export function extractYoutubeLinks(content: string): LinkWithDomain[] {
    const regex = /https:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9-_]+)/g;
    const links: LinkWithDomain[] = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
        const videoID = match[1];
        // Use the nocookie domain with controls disabled to help prevent logging requests
        const embedUrl = `https://www.youtube-nocookie.com/embed/${videoID}?controls=0`;
        links.push({ url: embedUrl, domain: "youtube.com" });
    }
    return links;
}

// Extract video URLs from markdown (iframe and direct video links)
export function extractVideoUrls(markdown: string): string[] {
    const videoUrls: string[] = [];
    // Match <iframe src="...">
    const iframeRegex = /<iframe[^>]*src=["']([^"']+)["'][^>]*><\/iframe>/g;
    let match;
    while ((match = iframeRegex.exec(markdown)) !== null) {
        videoUrls.push(match[1]);
    }
    // Match direct video links in markdown image syntax (e.g., ![desc](url.mp4))
    const videoImageRegex = /!\[.*?\]\((.*?\.(mp4|webm|mov|avi|wmv|flv|mkv))\)/gi;
    while ((match = videoImageRegex.exec(markdown)) !== null) {
        videoUrls.push(match[1]);
    }
    return videoUrls;
}

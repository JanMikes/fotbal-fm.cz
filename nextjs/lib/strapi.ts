import {
    StrapiLoginResponse,
    StrapiRegisterResponse,
    StrapiUser,
    StrapiError,
} from '@/types/api';
import {User} from '@/types/user';
import {
    MatchResult,
    CreateMatchResultRequest,
    StrapiImage,
    StrapiFile,
    UserInfo,
} from '@/types/match-result';
import {
    Comment,
    CreateCommentRequest,
} from '@/types/comment';
import {
    Event,
    CreateEventRequest,
} from '@/types/event';
import {
    Tournament,
    CreateTournamentRequest,
} from '@/types/tournament';
import {
    TournamentMatch,
    CreateTournamentMatchRequest,
} from '@/types/tournament-match';
import {
    StrapiMatchResultData,
    StrapiMatchResultsCollectionResponse,
    StrapiMatchResultSingleResponse,
    StrapiMediaAttributes,
    StrapiDataWrapper,
} from '@/types/strapi-responses';
import { config, getPublicUploadsUrl } from './config';

const STRAPI_URL = config.STRAPI_URL;
const STRAPI_API_TOKEN = config.STRAPI_API_TOKEN;

/**
 * Transform image URL to use the public uploads URL (nginx)
 * This ensures images are served via nginx with proper cache headers
 */
function transformImageUrl(url: string): string {
    // If the URL starts with /uploads/, prefix it with the public uploads URL
    if (url.startsWith('/uploads/')) {
        return `${getPublicUploadsUrl()}${url}`;
    }
    return url;
}

/**
 * Transform image formats object to use nginx URLs for all format variants
 */
function transformImageFormats(formats: any): any {
    const transformed: any = {};
    for (const [key, value] of Object.entries(formats)) {
        if (value && typeof value === 'object' && 'url' in value) {
            transformed[key] = {
                ...value,
                url: transformImageUrl((value as any).url),
            };
        }
    }
    return transformed;
}

/**
 * Convert Strapi user to our User type
 */
function mapStrapiUser(strapiUser: StrapiUser): User {
    return {
        id: strapiUser.id,
        email: strapiUser.email,
        username: strapiUser.username,
        firstName: strapiUser.firstname,
        lastName: strapiUser.lastname,
        jobTitle: strapiUser.jobTitle,
        confirmed: strapiUser.confirmed,
        blocked: strapiUser.blocked,
        createdAt: strapiUser.createdAt,
        updatedAt: strapiUser.updatedAt,
    };
}

/**
 * Handle Strapi API errors
 */
function handleStrapiError(error: unknown): never {
    if (error && typeof error === 'object' && 'error' in error) {
        const strapiError = error as StrapiError;
        throw new Error(strapiError.error.message || 'Chyba při komunikaci se serverem');
    }
    throw new Error('Neznámá chyba při komunikaci se serverem');
}

/**
 * Map media array from Strapi response to StrapiImage[]
 */
function mapStrapiImages(data: any, fieldName: string, isFlattened: boolean): StrapiImage[] {
    let images: StrapiImage[] = [];

    if (isFlattened && Array.isArray(data[fieldName])) {
        images = data[fieldName].map((img: any): StrapiImage => ({
            id: img.id,
            name: img.name,
            alternativeText: img.alternativeText || null,
            caption: img.caption || null,
            width: img.width || 0,
            height: img.height || 0,
            formats: transformImageFormats(img.formats || {}),
            url: transformImageUrl(img.url),
            previewUrl: img.previewUrl || null,
            provider: img.provider,
            size: img.size,
            ext: img.ext,
            mime: img.mime,
            createdAt: img.createdAt,
            updatedAt: img.updatedAt,
        }));
    } else if (data[fieldName]?.data) {
        const imageData = data[fieldName].data;
        const mapMedia = (img: StrapiDataWrapper<StrapiMediaAttributes>): StrapiImage => ({
            id: img.id,
            name: img.attributes.name,
            alternativeText: img.attributes.alternativeText || null,
            caption: img.attributes.caption || null,
            width: img.attributes.width || 0,
            height: img.attributes.height || 0,
            formats: transformImageFormats(img.attributes.formats || {}),
            url: transformImageUrl(img.attributes.url),
            previewUrl: img.attributes.previewUrl || null,
            provider: img.attributes.provider,
            size: img.attributes.size,
            ext: img.attributes.ext,
            mime: img.attributes.mime,
            createdAt: img.attributes.createdAt,
            updatedAt: img.attributes.updatedAt,
        });

        images = Array.isArray(imageData)
            ? imageData.map(mapMedia)
            : [mapMedia(imageData)];
    }

    return images;
}

/**
 * Map media array from Strapi response to StrapiFile[]
 */
function mapStrapiFiles(data: any, fieldName: string, isFlattened: boolean): StrapiFile[] {
    let files: StrapiFile[] = [];

    if (isFlattened && Array.isArray(data[fieldName])) {
        files = data[fieldName].map((file: any): StrapiFile => ({
            id: file.id,
            name: file.name,
            alternativeText: file.alternativeText || null,
            caption: file.caption || null,
            url: transformImageUrl(file.url),
            previewUrl: file.previewUrl || null,
            provider: file.provider,
            size: file.size,
            ext: file.ext,
            mime: file.mime,
            createdAt: file.createdAt,
            updatedAt: file.updatedAt,
        }));
    } else if (data[fieldName]?.data) {
        const fileData = data[fieldName].data;
        const mapMedia = (file: any): StrapiFile => ({
            id: file.id,
            name: file.attributes?.name || file.name,
            alternativeText: file.attributes?.alternativeText || file.alternativeText || null,
            caption: file.attributes?.caption || file.caption || null,
            url: transformImageUrl(file.attributes?.url || file.url),
            previewUrl: file.attributes?.previewUrl || file.previewUrl || null,
            provider: file.attributes?.provider || file.provider,
            size: file.attributes?.size || file.size,
            ext: file.attributes?.ext || file.ext,
            mime: file.attributes?.mime || file.mime,
            createdAt: file.attributes?.createdAt || file.createdAt,
            updatedAt: file.attributes?.updatedAt || file.updatedAt,
        });

        files = Array.isArray(fileData)
            ? fileData.map(mapMedia)
            : [mapMedia(fileData)];
    }

    return files;
}

/**
 * Map user info from Strapi response
 * Handles both flattened and nested structures automatically.
 * Field-specific population may return nested even when parent is flattened.
 */
function mapUserInfo(userData: any, _isFlattened: boolean): UserInfo | undefined {
    if (!userData) return undefined;

    // Handle both flattened and nested structures
    // Check for nested structure first (userData.data), fall back to direct access
    const data = userData.data ?? userData;

    const hasData = data?.id || data?.firstname || data?.lastname;
    if (!hasData) return undefined;

    return {
        id: data?.id || 0,
        firstName: data?.firstname || '',
        lastName: data?.lastname || '',
    };
}

/**
 * Login user with Strapi
 */
export async function strapiLogin(
    email: string,
    password: string
): Promise<{ user: User; jwt: string }> {
    try {
        const response = await fetch(`${STRAPI_URL}/api/auth/local`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                identifier: email,
                password,
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            handleStrapiError(error);
        }

        const data: StrapiLoginResponse = await response.json();

        return {
            user: mapStrapiUser(data.user),
            jwt: data.jwt,
        };
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Chyba při přihlašování');
    }
}

/**
 * Register new user with Strapi
 * Two-step process:
 * 1. Register with basic fields (username, email, password)
 * 2. Update profile with custom fields (firstname, lastname, jobTitle)
 */
export async function strapiRegister(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    jobTitle: string;
}): Promise<{ user: User; jwt: string }> {
    try {
        // Step 1: Register with basic fields only
        const registerResponse = await fetch(`${STRAPI_URL}/api/auth/local/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: userData.email, // username = email
                email: userData.email,
                password: userData.password,
            }),
        });

        if (!registerResponse.ok) {
            const error = await registerResponse.json();
            handleStrapiError(error);
        }

        const registerData: StrapiRegisterResponse = await registerResponse.json();

        // Step 2: Update user profile with custom fields
        const updateResponse = await fetch(`${STRAPI_URL}/api/users/${registerData.user.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${registerData.jwt}`,
            },
            body: JSON.stringify({
                firstname: userData.firstName,
                lastname: userData.lastName,
                jobTitle: userData.jobTitle,
            }),
        });

        if (!updateResponse.ok) {
            const error = await updateResponse.json();
            handleStrapiError(error);
        }

        const updatedUser: StrapiUser = await updateResponse.json();

        return {
            user: mapStrapiUser(updatedUser),
            jwt: registerData.jwt,
        };
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Chyba při registraci');
    }
}

/**
 * Get current user data from Strapi using JWT
 */
export async function strapiGetMe(jwt: string): Promise<User> {
    try {
        const response = await fetch(`${STRAPI_URL}/api/users/me`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${jwt}`,
            },
        });

        if (!response.ok) {
            const error = await response.json();
            handleStrapiError(error);
        }

        const data: StrapiUser = await response.json();

        return mapStrapiUser(data);
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Chyba při načítání uživatelských dat');
    }
}

/**
 * Update user profile in Strapi
 */
export async function strapiUpdateProfile(
    jwt: string,
    userId: number,
    profileData: {
        firstName: string;
        lastName: string;
        jobTitle: string;
    }
): Promise<User> {
    try {
        const response = await fetch(`${STRAPI_URL}/api/users/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${jwt}`,
            },
            body: JSON.stringify({
                firstname: profileData.firstName,
                lastname: profileData.lastName,
                jobTitle: profileData.jobTitle,
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            handleStrapiError(error);
        }

        const data: StrapiUser = await response.json();

        return mapStrapiUser(data);
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Chyba při aktualizaci profilu');
    }
}

/**
 * Change user password in Strapi
 */
export async function strapiChangePassword(
    jwt: string,
    currentPassword: string,
    newPassword: string
): Promise<void> {
    try {
        const response = await fetch(`${STRAPI_URL}/api/auth/change-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${jwt}`,
            },
            body: JSON.stringify({
                currentPassword,
                password: newPassword,
                passwordConfirmation: newPassword,
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            handleStrapiError(error);
        }
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Chyba při změně hesla');
    }
}

/**
 * Service-to-service API call using STRAPI_API_TOKEN
 * Use this for operations that don't require user authentication
 */
export async function strapiServiceCall<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    if (!STRAPI_API_TOKEN) {
        throw new Error('STRAPI_API_TOKEN is not configured');
    }

    try {
        const response = await fetch(`${STRAPI_URL}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${STRAPI_API_TOKEN}`,
                ...options.headers,
            },
        });

        if (!response.ok) {
            const error = await response.json();
            handleStrapiError(error);
        }

        return await response.json();
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Chyba při komunikaci se serverem');
    }
}

/**
 * Upload files to Strapi and link them to an entry
 */
async function uploadFilesToStrapi(
    jwt: string,
    files: File[],
    ref: string,
    refId: number,
    field: string
): Promise<void> {
    if (files.length === 0) return;

    const formData = new FormData();
    files.forEach((file) => {
        formData.append('files', file, file.name);
    });
    formData.append('ref', ref);
    formData.append('refId', String(refId));
    formData.append('field', field);

    const response = await fetch(`${STRAPI_URL}/api/upload`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${jwt}`,
        },
        body: formData,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error(`File upload to ${field} failed:`, error);
    }
}

/**
 * Convert Strapi match result response to MatchResult type
 * Strapi 5 with populate=* returns flattened structure (fields directly on data)
 * Strapi 5 without populate returns nested structure (fields in attributes)
 */
function mapStrapiMatchResult(strapiData: StrapiMatchResultData | any): MatchResult {
    const { id, documentId, attributes } = strapiData;

    // Strapi 5: determine if response is flattened or nested
    const isFlattened = !attributes && 'homeTeam' in strapiData;
    const data = isFlattened ? strapiData : attributes;

    // Strapi 5 uses documentId for API calls
    const entityId = documentId || id;

    if (!data) {
        throw new Error('Invalid match result data: missing data');
    }

    const images = mapStrapiImages(data, 'images', isFlattened);
    const files = mapStrapiFiles(data, 'files', isFlattened);

    // Handle author field for userId (flattened structure has author.id)
    const userId = isFlattened ? data.author?.id : data.userId;
    const author = mapUserInfo(data.author, isFlattened);
    const modifiedBy = mapUserInfo(data.lastModifiedBy, isFlattened);

    // Map categories
    const categories = Array.isArray(data.categories)
        ? data.categories.map((c: any) => ({
            id: c.documentId || String(c.id),
            name: c.name,
            slug: c.slug,
            sortOrder: c.sortOrder || 0,
          }))
        : [];

    return {
        id: entityId,
        homeTeam: data.homeTeam,
        awayTeam: data.awayTeam,
        homeScore: data.homeScore,
        awayScore: data.awayScore,
        homeGoalscorers: data.homeGoalscorers || undefined,
        awayGoalscorers: data.awayGoalscorers || undefined,
        matchReport: data.matchReport || undefined,
        categories,
        matchDate: data.matchDate,
        imagesUrl: data.imagesUrl || undefined,
        images,
        files,
        authorId: userId,
        author,
        modifiedBy,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
    };
}

/**
 * Create a new match result in Strapi with file uploads
 */
export async function strapiCreateMatchResult(
    jwt: string,
    data: CreateMatchResultRequest,
    images: File[],
    files: File[] = []
): Promise<MatchResult> {
    try {
        // First, create the match result without media
        const createResponse = await fetch(`${STRAPI_URL}/api/match-results`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${jwt}`,
            },
            body: JSON.stringify({ data }),
        });

        if (!createResponse.ok) {
            const error = await createResponse.json();
            handleStrapiError(error);
        }

        const createData: StrapiMatchResultSingleResponse = await createResponse.json();

        if (!createData.data) {
            throw new Error('Nepodařilo se vytvořit výsledek zápasu');
        }

        const entryId = createData.data.id;

        // Upload images if present
        await uploadFilesToStrapi(jwt, images, 'api::match-result.match-result', entryId, 'images');

        // Upload files if present
        await uploadFilesToStrapi(jwt, files, 'api::match-result.match-result', entryId, 'files');

        // Fetch the updated entry with all fields populated
        const identifier = createData.data.documentId || createData.data.id;
        const getResponse = await fetch(
            `${STRAPI_URL}/api/match-results/${identifier}?populate=*`,
            {
                headers: {
                    Authorization: `Bearer ${jwt}`,
                },
            }
        );

        if (getResponse.ok) {
            const getData: StrapiMatchResultSingleResponse = await getResponse.json();
            if (getData.data) {
                return mapStrapiMatchResult(getData.data);
            }
        }

        return mapStrapiMatchResult(createData.data);
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Chyba při vytváření výsledku zápasu');
    }
}

/**
 * Get match results for a specific user
 */
export async function strapiGetUserMatchResults(
    jwt: string,
    userId: number
): Promise<MatchResult[]> {
    try {
        const response = await fetch(
            `${STRAPI_URL}/api/match-results?populate=*&sort=createdAt:desc&filters[author][id][$eq]=${userId}`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${jwt}`,
                },
            }
        );

        if (!response.ok) {
            const error = await response.json();
            handleStrapiError(error);
        }

        const responseData: StrapiMatchResultsCollectionResponse = await response.json();

        return responseData.data.map(mapStrapiMatchResult);
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Chyba při načítání výsledků zápasů');
    }
}

// ==================== EVENT FUNCTIONS ====================

/**
 * Convert Strapi event response to Event type
 */
function mapStrapiEvent(strapiData: any): Event {
    const { id, documentId, attributes } = strapiData;
    const isFlattened = !attributes && 'name' in strapiData;
    const data = isFlattened ? strapiData : attributes;

    // Strapi 5 uses documentId for API calls
    const entityId = documentId || id;

    if (!data) {
        throw new Error('Invalid event data: missing data');
    }

    const photos = mapStrapiImages(data, 'photos', isFlattened);
    const files = mapStrapiFiles(data, 'files', isFlattened);
    const userId = isFlattened ? data.author?.id : data.userId;
    const author = mapUserInfo(data.author, isFlattened);
    const modifiedBy = mapUserInfo(data.modifiedBy, isFlattened);

    return {
        id: entityId,
        name: data.name,
        eventType: data.eventType,
        dateFrom: data.dateFrom,
        dateTo: data.dateTo || undefined,
        publishDate: data.publishDate || undefined,
        eventTime: data.eventTime || undefined,
        description: data.description || undefined,
        requiresPhotographer: data.requiresPhotographer || false,
        photos,
        files,
        authorId: userId,
        author,
        modifiedBy,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
    };
}

/**
 * Create a new event in Strapi
 */
export async function strapiCreateEvent(
    jwt: string,
    data: CreateEventRequest,
    photos: File[],
    files: File[]
): Promise<Event> {
    try {
        const createResponse = await fetch(`${STRAPI_URL}/api/events`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${jwt}`,
            },
            body: JSON.stringify({ data }),
        });

        if (!createResponse.ok) {
            const error = await createResponse.json();
            handleStrapiError(error);
        }

        const createData = await createResponse.json();

        if (!createData.data) {
            throw new Error('Nepodařilo se vytvořit událost');
        }

        const entryId = createData.data.id;

        // Upload photos if present
        await uploadFilesToStrapi(jwt, photos, 'api::event.event', entryId, 'photos');

        // Upload files if present
        await uploadFilesToStrapi(jwt, files, 'api::event.event', entryId, 'files');

        // Fetch the updated entry
        const identifier = createData.data.documentId || createData.data.id;
        const getResponse = await fetch(
            `${STRAPI_URL}/api/events/${identifier}?populate=*`,
            {
                headers: {
                    Authorization: `Bearer ${jwt}`,
                },
            }
        );

        if (getResponse.ok) {
            const getData = await getResponse.json();
            if (getData.data) {
                return mapStrapiEvent(getData.data);
            }
        }

        return mapStrapiEvent(createData.data);
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Chyba při vytváření události');
    }
}

/**
 * Get events for a specific user
 */
export async function strapiGetUserEvents(
    jwt: string,
    userId: number
): Promise<Event[]> {
    try {
        const response = await fetch(
            `${STRAPI_URL}/api/events?populate=*&sort=createdAt:desc&filters[author][id][$eq]=${userId}`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${jwt}`,
                },
            }
        );

        if (!response.ok) {
            const error = await response.json();
            handleStrapiError(error);
        }

        const responseData = await response.json();
        return responseData.data.map(mapStrapiEvent);
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Chyba při načítání událostí');
    }
}

// ==================== TOURNAMENT FUNCTIONS ====================

/**
 * Convert Strapi tournament response to Tournament type
 */
function mapStrapiTournament(strapiData: any): Tournament {
    // DEBUG: Log raw Strapi response (truncated for readability)
    console.log('[mapStrapiTournament] Raw input:', JSON.stringify(strapiData, null, 2).slice(0, 500));

    // Defensive check for undefined input
    if (!strapiData) {
        console.error('[mapStrapiTournament] Received undefined strapiData');
        throw new Error('Invalid tournament data: strapiData is undefined');
    }

    const { id, documentId, attributes } = strapiData;
    const isFlattened = !attributes && 'name' in strapiData;
    const data = isFlattened ? strapiData : attributes;

    // Strapi 5 uses documentId for API calls
    const entityId = documentId || id;

    // Defensive check for missing ID
    if (!entityId) {
        console.error('[mapStrapiTournament] Missing entityId:', { id, documentId, strapiData });
        throw new Error('Invalid tournament data: missing ID');
    }

    if (!data) {
        throw new Error('Invalid tournament data: missing data');
    }

    const photos = mapStrapiImages(data, 'photos', isFlattened);
    const userId = isFlattened ? data.author?.id : data.userId;
    const author = mapUserInfo(data.author, isFlattened);
    const modifiedBy = mapUserInfo(data.modifiedBy, isFlattened);

    // Map players component (repeatable)
    const players = Array.isArray(data.players)
        ? data.players.map((p: any) => ({
              id: p.id,
              title: p.title,
              playerName: p.playerName,
          }))
        : [];

    // Map tournament matches (relation: tournamentMatches)
    const matchesData = data.tournamentMatches || data.tournament_matches;
    const matches = Array.isArray(matchesData)
        ? matchesData.map((m: any) => mapStrapiTournamentMatch(m))
        : [];

    // Map categories
    const categories = Array.isArray(data.categories)
        ? data.categories.map((c: any) => ({
            id: c.documentId || String(c.id),
            name: c.name,
            slug: c.slug,
            sortOrder: c.sortOrder || 0,
          }))
        : [];

    return {
        id: entityId,
        name: data.name,
        description: data.description || undefined,
        location: data.location || undefined,
        dateFrom: data.dateFrom,
        dateTo: data.dateTo || undefined,
        categories,
        photos,
        imagesUrl: data.imagesUrl || undefined,
        players,
        matches,
        authorId: userId,
        author,
        modifiedBy,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
    };
}

/**
 * Create a new tournament in Strapi
 */
export async function strapiCreateTournament(
    jwt: string,
    data: CreateTournamentRequest,
    photos: File[]
): Promise<Tournament> {
    try {
        const createResponse = await fetch(`${STRAPI_URL}/api/tournaments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${jwt}`,
            },
            body: JSON.stringify({ data }),
        });

        if (!createResponse.ok) {
            const error = await createResponse.json();
            handleStrapiError(error);
        }

        const createData = await createResponse.json();

        if (!createData.data) {
            throw new Error('Nepodařilo se vytvořit turnaj');
        }

        const entryId = createData.data.id;

        // Upload photos if present
        await uploadFilesToStrapi(jwt, photos, 'api::tournament.tournament', entryId, 'photos');

        // Fetch the updated entry
        const identifier = createData.data.documentId || createData.data.id;
        const getResponse = await fetch(
            `${STRAPI_URL}/api/tournaments/${identifier}?populate=*`,
            {
                headers: {
                    Authorization: `Bearer ${jwt}`,
                },
            }
        );

        if (getResponse.ok) {
            const getData = await getResponse.json();
            if (getData.data) {
                return mapStrapiTournament(getData.data);
            }
        }

        return mapStrapiTournament(createData.data);
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Chyba při vytváření turnaje');
    }
}

/**
 * Get tournaments for a specific user
 */
export async function strapiGetUserTournaments(
    jwt: string,
    userId: number
): Promise<Tournament[]> {
    try {
        const response = await fetch(
            `${STRAPI_URL}/api/tournaments?populate=*&sort=createdAt:desc&filters[author][id][$eq]=${userId}`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${jwt}`,
                },
            }
        );

        if (!response.ok) {
            const error = await response.json();
            handleStrapiError(error);
        }

        const responseData = await response.json();
        return responseData.data.map(mapStrapiTournament);
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Chyba při načítání turnajů');
    }
}

/**
 * Get all tournaments (for dropdown in tournament match form)
 */
export async function strapiGetAllTournaments(jwt: string): Promise<Tournament[]> {
    try {
        const response = await fetch(
            `${STRAPI_URL}/api/tournaments?sort=dateFrom:desc&pagination[limit]=100`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${jwt}`,
                },
            }
        );

        if (!response.ok) {
            const error = await response.json();
            handleStrapiError(error);
        }

        const responseData = await response.json();
        return responseData.data.map(mapStrapiTournament);
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Chyba při načítání turnajů');
    }
}

// ==================== TOURNAMENT MATCH FUNCTIONS ====================

/**
 * Convert Strapi tournament match response to TournamentMatch type
 */
function mapStrapiTournamentMatch(strapiData: any): TournamentMatch {
    const { id, documentId, attributes } = strapiData;
    const isFlattened = !attributes && 'homeTeam' in strapiData;
    const data = isFlattened ? strapiData : attributes;

    // Strapi 5 uses documentId for API calls
    const entityId = documentId || id;

    if (!data) {
        throw new Error('Invalid tournament match data: missing data');
    }

    const userId = isFlattened ? data.author?.id : data.userId;
    const tournamentId = isFlattened ? data.tournament?.id : data.tournamentId;
    const author = mapUserInfo(data.author, isFlattened);
    const modifiedBy = mapUserInfo(data.modifiedBy, isFlattened);

    return {
        id: entityId,
        homeTeam: data.homeTeam,
        awayTeam: data.awayTeam,
        homeScore: data.homeScore,
        awayScore: data.awayScore,
        homeGoalscorers: data.homeGoalscorers || undefined,
        awayGoalscorers: data.awayGoalscorers || undefined,
        tournamentId,
        authorId: userId,
        author,
        modifiedBy,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
    };
}

/**
 * Create a new tournament match in Strapi
 */
export async function strapiCreateTournamentMatch(
    jwt: string,
    data: CreateTournamentMatchRequest
): Promise<TournamentMatch> {
    try {
        const createResponse = await fetch(`${STRAPI_URL}/api/tournament-matches`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${jwt}`,
            },
            body: JSON.stringify({ data }),
        });

        if (!createResponse.ok) {
            const error = await createResponse.json();
            handleStrapiError(error);
        }

        const createData = await createResponse.json();

        if (!createData.data) {
            throw new Error('Nepodařilo se vytvořit turnajový zápas');
        }

        return mapStrapiTournamentMatch(createData.data);
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Chyba při vytváření turnajového zápasu');
    }
}

/**
 * Get tournament matches for a specific tournament
 */
export async function strapiGetTournamentMatches(
    jwt: string,
    tournamentId: number
): Promise<TournamentMatch[]> {
    try {
        const response = await fetch(
            `${STRAPI_URL}/api/tournament-matches?populate=*&sort=createdAt:asc&filters[tournament][id][$eq]=${tournamentId}`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${jwt}`,
                },
            }
        );

        if (!response.ok) {
            const error = await response.json();
            handleStrapiError(error);
        }

        const responseData = await response.json();
        return responseData.data.map(mapStrapiTournamentMatch);
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Chyba při načítání turnajových zápasů');
    }
}

// ==================== GET ALL FUNCTIONS (WITH OPTIONAL USER FILTER) ====================

/**
 * Get all match results (optionally filtered by user)
 */
export async function strapiGetAllMatchResults(
    jwt: string,
    userId?: number
): Promise<MatchResult[]> {
    try {
        let url = `${STRAPI_URL}/api/match-results?populate=*&sort=createdAt:desc&pagination[limit]=100`;
        if (userId) {
            url += `&filters[author][id][$eq]=${userId}`;
        }

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${jwt}`,
            },
        });

        if (!response.ok) {
            const error = await response.json();
            handleStrapiError(error);
        }

        const responseData = await response.json();
        return responseData.data.map(mapStrapiMatchResult);
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Chyba při načítání výsledků zápasů');
    }
}

/**
 * Get all events (optionally filtered by user)
 */
export async function strapiGetAllEvents(
    jwt: string,
    userId?: number
): Promise<Event[]> {
    try {
        let url = `${STRAPI_URL}/api/events?populate=*&sort=createdAt:desc&pagination[limit]=100`;
        if (userId) {
            url += `&filters[author][id][$eq]=${userId}`;
        }

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${jwt}`,
            },
        });

        if (!response.ok) {
            const error = await response.json();
            handleStrapiError(error);
        }

        const responseData = await response.json();
        return responseData.data.map(mapStrapiEvent);
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Chyba při načítání událostí');
    }
}

/**
 * Get all tournaments (optionally filtered by user)
 */
export async function strapiGetTournamentsWithFilter(
    jwt: string,
    userId?: number
): Promise<Tournament[]> {
    try {
        let url = `${STRAPI_URL}/api/tournaments?populate=*&sort=createdAt:desc&pagination[limit]=100`;
        if (userId) {
            url += `&filters[author][id][$eq]=${userId}`;
        }

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${jwt}`,
            },
        });

        if (!response.ok) {
            const error = await response.json();
            handleStrapiError(error);
        }

        const responseData = await response.json();
        return responseData.data.map(mapStrapiTournament);
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Chyba při načítání turnajů');
    }
}

// ==================== GET SINGLE FUNCTIONS ====================

/**
 * Get a single match result by ID
 */
export async function strapiGetMatchResult(
    jwt: string,
    id: number | string
): Promise<MatchResult> {
    try {
        const response = await fetch(
            `${STRAPI_URL}/api/match-results/${id}?populate=*`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${jwt}`,
                },
            }
        );

        if (!response.ok) {
            const error = await response.json();
            handleStrapiError(error);
        }

        const responseData = await response.json();
        return mapStrapiMatchResult(responseData.data);
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Chyba při načítání výsledku zápasu');
    }
}

/**
 * Get a single event by ID
 */
export async function strapiGetEvent(
    jwt: string,
    id: number | string
): Promise<Event> {
    try {
        const response = await fetch(
            `${STRAPI_URL}/api/events/${id}?populate=*`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${jwt}`,
                },
            }
        );

        if (!response.ok) {
            const error = await response.json();
            handleStrapiError(error);
        }

        const responseData = await response.json();
        return mapStrapiEvent(responseData.data);
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Chyba při načítání události');
    }
}

/**
 * Get a single tournament by ID
 */
export async function strapiGetTournament(
    jwt: string,
    id: number | string
): Promise<Tournament> {
    try {
        const response = await fetch(
            `${STRAPI_URL}/api/tournaments/${id}?populate=*`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${jwt}`,
                },
            }
        );

        if (!response.ok) {
            const error = await response.json();
            handleStrapiError(error);
        }

        const responseData = await response.json();
        return mapStrapiTournament(responseData.data);
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Chyba při načítání turnaje');
    }
}

/**
 * Get a single tournament match by ID
 */
export async function strapiGetTournamentMatch(
    jwt: string,
    id: number | string
): Promise<TournamentMatch> {
    try {
        const response = await fetch(
            `${STRAPI_URL}/api/tournament-matches/${id}?populate=*`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${jwt}`,
                },
            }
        );

        if (!response.ok) {
            const error = await response.json();
            handleStrapiError(error);
        }

        const responseData = await response.json();
        return mapStrapiTournamentMatch(responseData.data);
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Chyba při načítání turnajového zápasu');
    }
}

// ==================== UPDATE FUNCTIONS ====================

/**
 * Update a match result
 */
export async function strapiUpdateMatchResult(
    jwt: string,
    id: number | string,
    data: Partial<CreateMatchResultRequest>,
    images?: File[],
    files?: File[]
): Promise<MatchResult> {
    try {
        const updateResponse = await fetch(`${STRAPI_URL}/api/match-results/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${jwt}`,
            },
            body: JSON.stringify({ data }),
        });

        if (!updateResponse.ok) {
            const error = await updateResponse.json();
            handleStrapiError(error);
        }

        const updateData = await updateResponse.json();
        const entryId = updateData.data.id;

        // Upload new images if present
        if (images && images.length > 0) {
            await uploadFilesToStrapi(jwt, images, 'api::match-result.match-result', entryId, 'images');
        }

        // Upload new files if present
        if (files && files.length > 0) {
            await uploadFilesToStrapi(jwt, files, 'api::match-result.match-result', entryId, 'files');
        }

        // Fetch the updated entry
        return await strapiGetMatchResult(jwt, id);
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Chyba při aktualizaci výsledku zápasu');
    }
}

/**
 * Update an event
 */
export async function strapiUpdateEvent(
    jwt: string,
    id: number | string,
    data: Partial<CreateEventRequest>,
    photos?: File[],
    files?: File[]
): Promise<Event> {
    try {
        const updateResponse = await fetch(`${STRAPI_URL}/api/events/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${jwt}`,
            },
            body: JSON.stringify({ data }),
        });

        if (!updateResponse.ok) {
            const error = await updateResponse.json();
            handleStrapiError(error);
        }

        const updateData = await updateResponse.json();
        const entryId = updateData.data.id;

        // Upload new photos if present
        if (photos && photos.length > 0) {
            await uploadFilesToStrapi(jwt, photos, 'api::event.event', entryId, 'photos');
        }

        // Upload new files if present
        if (files && files.length > 0) {
            await uploadFilesToStrapi(jwt, files, 'api::event.event', entryId, 'files');
        }

        // Fetch the updated entry
        return await strapiGetEvent(jwt, id);
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Chyba při aktualizaci události');
    }
}

/**
 * Update a tournament
 */
export async function strapiUpdateTournament(
    jwt: string,
    id: number | string,
    data: Partial<CreateTournamentRequest>,
    photos?: File[]
): Promise<Tournament> {
    try {
        const updateResponse = await fetch(`${STRAPI_URL}/api/tournaments/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${jwt}`,
            },
            body: JSON.stringify({ data }),
        });

        if (!updateResponse.ok) {
            const error = await updateResponse.json();
            handleStrapiError(error);
        }

        const updateData = await updateResponse.json();
        const entryId = updateData.data.id;

        // Upload new photos if present
        if (photos && photos.length > 0) {
            await uploadFilesToStrapi(jwt, photos, 'api::tournament.tournament', entryId, 'photos');
        }

        // Fetch the updated entry
        return await strapiGetTournament(jwt, id);
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Chyba při aktualizaci turnaje');
    }
}

/**
 * Update a tournament match
 */
export async function strapiUpdateTournamentMatch(
    jwt: string,
    id: number | string,
    data: Partial<CreateTournamentMatchRequest>
): Promise<TournamentMatch> {
    try {
        const updateResponse = await fetch(`${STRAPI_URL}/api/tournament-matches/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${jwt}`,
            },
            body: JSON.stringify({ data }),
        });

        if (!updateResponse.ok) {
            const error = await updateResponse.json();
            handleStrapiError(error);
        }

        // Fetch the updated entry
        return await strapiGetTournamentMatch(jwt, id);
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Chyba při aktualizaci turnajového zápasu');
    }
}

// ==================== COMMENT FUNCTIONS ====================

/**
 * Map Strapi comment response to Comment type
 */
function mapStrapiComment(strapiData: any): Comment {
    const { id, documentId, attributes } = strapiData;
    const isFlattened = !attributes && 'content' in strapiData;
    const data = isFlattened ? strapiData : attributes;

    if (!data) {
        throw new Error('Invalid comment data: missing data');
    }

    const author = mapUserInfo(data.author, isFlattened) || {
        id: 0,
        firstName: '',
        lastName: '',
    };

    // Use documentId for parent comment reference (Strapi 5)
    const parentCommentId = isFlattened
        ? data.parentComment?.documentId
        : data.parentComment?.data?.documentId;

    // Map replies if present
    let replies: Comment[] | undefined;
    if (data.replies) {
        const repliesData = isFlattened ? data.replies : data.replies?.data;
        if (Array.isArray(repliesData) && repliesData.length > 0) {
            replies = repliesData.map(mapStrapiComment);
        }
    }

    return {
        id,
        documentId,
        content: data.content,
        author,
        parentCommentId: parentCommentId || undefined,
        replies,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
    };
}

/**
 * Create a new comment
 */
export async function strapiCreateComment(
    jwt: string,
    data: CreateCommentRequest
): Promise<Comment> {
    try {
        const createResponse = await fetch(`${STRAPI_URL}/api/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${jwt}`,
            },
            body: JSON.stringify({ data }),
        });

        if (!createResponse.ok) {
            const error = await createResponse.json();
            handleStrapiError(error);
        }

        const createData = await createResponse.json();

        if (!createData.data) {
            throw new Error('Nepodařilo se vytvořit komentář');
        }

        return mapStrapiComment(createData.data);
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Chyba při vytváření komentáře');
    }
}

/**
 * Get comments for an entity (match result, tournament, or event)
 */
export async function strapiGetComments(
    jwt: string,
    entityType: 'matchResult' | 'tournament' | 'event',
    entityId: string
): Promise<Comment[]> {
    try {
        // Build filter based on entity type
        const filterField = entityType === 'matchResult' ? 'matchResult' : entityType;

        // Get top-level comments (no parent) with replies populated
        // Select specific author fields to avoid "Invalid key role" error
        // Filter by documentId instead of numeric id for Strapi 5
        const response = await fetch(
            `${STRAPI_URL}/api/comments?populate[author][fields][0]=id&populate[author][fields][1]=documentId&populate[author][fields][2]=firstname&populate[author][fields][3]=lastname&populate[replies][populate][author][fields][0]=id&populate[replies][populate][author][fields][1]=documentId&populate[replies][populate][author][fields][2]=firstname&populate[replies][populate][author][fields][3]=lastname&sort=createdAt:desc&filters[${filterField}][documentId][$eq]=${entityId}&filters[parentComment][id][$null]=true`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${jwt}`,
                },
            }
        );

        if (!response.ok) {
            const error = await response.json();
            handleStrapiError(error);
        }

        const responseData = await response.json();
        return responseData.data.map(mapStrapiComment);
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Chyba při načítání komentářů');
    }
}

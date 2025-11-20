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
} from '@/types/match-result';
import {
    StrapiMatchResultData,
    StrapiMatchResultsCollectionResponse,
    StrapiMatchResultSingleResponse,
    StrapiMediaAttributes,
    StrapiDataWrapper,
} from '@/types/strapi-responses';
import { config } from './config';

const STRAPI_URL = config.STRAPI_URL;
const STRAPI_API_TOKEN = config.STRAPI_API_TOKEN;

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
 * Convert Strapi match result response to MatchResult type
 * Strapi 5 with populate=* returns flattened structure (fields directly on data)
 * Strapi 5 without populate returns nested structure (fields in attributes)
 */
function mapStrapiMatchResult(strapiData: StrapiMatchResultData | any): MatchResult {
    const { id, attributes } = strapiData;

    // Strapi 5: determine if response is flattened or nested
    // Flattened: fields are directly on strapiData (when using populate=*)
    // Nested: fields are in attributes (when not using populate)
    const isFlattened = !attributes && 'homeTeam' in strapiData;
    const data = isFlattened ? strapiData : attributes;

    if (!data) {
        throw new Error('Invalid match result data: missing data');
    }

    // Map images if they exist
    let images: StrapiImage[] = [];

    if (isFlattened && Array.isArray(data.images)) {
        // Flattened structure: images is an array of media objects directly
        images = data.images.map((img: any): StrapiImage => ({
            id: img.id,
            name: img.name,
            alternativeText: img.alternativeText || null,
            caption: img.caption || null,
            width: img.width || 0,
            height: img.height || 0,
            formats: img.formats || {},
            url: img.url,
            previewUrl: img.previewUrl || null,
            provider: img.provider,
            size: img.size,
            ext: img.ext,
            mime: img.mime,
            createdAt: img.createdAt,
            updatedAt: img.updatedAt,
        }));
    } else if (data.images?.data) {
        // Nested structure: images.data contains wrapped media objects
        const imageData = data.images.data;
        const mapMedia = (img: StrapiDataWrapper<StrapiMediaAttributes>): StrapiImage => ({
            id: img.id,
            name: img.attributes.name,
            alternativeText: img.attributes.alternativeText || null,
            caption: img.attributes.caption || null,
            width: img.attributes.width || 0,
            height: img.attributes.height || 0,
            formats: img.attributes.formats || {},
            url: img.attributes.url,
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

    // Handle author field for userId (flattened structure has author.id)
    const userId = isFlattened ? data.author?.id : data.userId;

    return {
        id,
        homeTeam: data.homeTeam,
        awayTeam: data.awayTeam,
        homeScore: data.homeScore,
        awayScore: data.awayScore,
        homeGoalscorers: data.homeGoalscorers || undefined,
        awayGoalscorers: data.awayGoalscorers || undefined,
        matchReport: data.matchReport || undefined,
        images,
        authorId: userId,
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
    images: File[]
): Promise<MatchResult> {
    try {
        // First, create the match result without images
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

        // If we have images, upload them and link to the created entry
        if (images.length > 0) {
            const formData = new FormData();

            // Add files
            images.forEach((image) => {
                formData.append('files', image, image.name);
            });

            // Link to the created entry
            formData.append('ref', 'api::match-result.match-result');
            formData.append('refId', String(createData.data.id));
            formData.append('field', 'images');

            const uploadResponse = await fetch(`${STRAPI_URL}/api/upload`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${jwt}`,
                },
                body: formData,
            });

            if (!uploadResponse.ok) {
                // Log the error but don't fail the whole operation
                const uploadError = await uploadResponse.json().catch(() => ({}));
                console.error('Image upload failed:', uploadError);
                // Return the match result without images
                return mapStrapiMatchResult(createData.data);
            }

            // Fetch the updated entry with images populated
            // In Strapi 5, use documentId if available, otherwise fall back to id
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

            // If refetch fails, return original data
            return mapStrapiMatchResult(createData.data);
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

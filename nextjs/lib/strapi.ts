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
    StrapiMatchResultResponse,
    StrapiMatchResultsResponse,
} from '@/types/match-result';
import {
    StrapiMatchResultData,
    StrapiMatchResultsCollectionResponse,
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
 * Properly typed to handle Strapi's nested data structure
 */
function mapStrapiMatchResult(strapiData: StrapiMatchResultData): MatchResult {
    const { id, attributes } = strapiData;

    // Map images if they exist
    let images: StrapiMediaAttributes[] = [];
    if (attributes.images?.data) {
        const imageData = attributes.images.data;
        images = Array.isArray(imageData)
            ? imageData.map((img: StrapiDataWrapper<StrapiMediaAttributes>) => img.attributes)
            : [imageData.attributes];
    }

    return {
        id,
        homeTeam: attributes.homeTeam,
        awayTeam: attributes.awayTeam,
        homeScore: attributes.homeScore,
        awayScore: attributes.awayScore,
        homeGoalscorers: attributes.homeGoalscorers || undefined,
        awayGoalscorers: attributes.awayGoalscorers || undefined,
        matchReport: attributes.matchReport || undefined,
        images,
        authorId: attributes.userId,
        createdAt: attributes.createdAt,
        updatedAt: attributes.updatedAt,
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

        const createData: StrapiMatchResultResponse = await createResponse.json();

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
                // Don't fail the whole operation if images fail
                // The match result was created successfully
            }

            // Fetch the updated entry with images populated
            const getResponse = await fetch(
                `${STRAPI_URL}/api/match-results/${createData.data.id}?populate=*`,
                {
                    headers: {
                        Authorization: `Bearer ${jwt}`,
                    },
                }
            );

            if (getResponse.ok) {
                const getData: StrapiMatchResultResponse = await getResponse.json();
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

        const responseData: StrapiMatchResultsResponse = await response.json();

        return responseData.data.map(mapStrapiMatchResult);
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Chyba při načítání výsledků zápasů');
    }
}

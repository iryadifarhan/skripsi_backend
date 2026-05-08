function cookieValue(name: string): string | null {
    const match = document.cookie
        .split('; ')
        .find((row) => row.startsWith(`${name}=`));

    if (!match) {
        return null;
    }

    return decodeURIComponent(match.split('=').slice(1).join('='));
}

export function csrfToken(): string {
    return cookieValue('XSRF-TOKEN') ?? document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
}

export function csrfHeaders(): Record<string, string> {
    const cookieToken = cookieValue('XSRF-TOKEN');

    if (cookieToken) {
        return {
            'X-XSRF-TOKEN': cookieToken,
        };
    }

    const metaToken = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';

    return metaToken
        ? {
            'X-CSRF-TOKEN': metaToken,
        }
        : {};
}

import {afterEach,expect,it,vi} from 'vitest';
import {collectionTestOrganization} from '@/lib/collections/test-mode';
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
afterEach(()=>vi.unstubAllEnvs());
it.each(['production','development',''])('does not activate test mode in %s',env=>{vi.stubEnv('VERCEL_ENV',env);vi.stubEnv('COLLECTIONS_TEST_ORGANIZATION_ID',id);expect(collectionTestOrganization()).toBeNull();});
it('requires an explicit valid Preview organization and fails closed on malformed configuration',()=>{vi.stubEnv('VERCEL_ENV','preview');vi.stubEnv('COLLECTIONS_TEST_ORGANIZATION_ID','');expect(collectionTestOrganization()).toBeNull();vi.stubEnv('COLLECTIONS_TEST_ORGANIZATION_ID','bad');expect(()=>collectionTestOrganization()).toThrow();vi.stubEnv('COLLECTIONS_TEST_ORGANIZATION_ID',id);expect(collectionTestOrganization()).toBe(id);});

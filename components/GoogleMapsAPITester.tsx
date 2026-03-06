import { MapPin, Navigation, Route, Search, Zap, CheckCircle, XCircle, Loader } from 'lucide-react';
import { geocodeAddress } from '../services/geocodingService';
import { getDistanceMatrix } from '../services/distanceMatrixService';
import { getDirections } from '../services/directionsService';
import { snapToRoads } from '../services/roadsService';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

interface TestResult {
    api: string;
    status: 'pending' | 'success' | 'error';
    message: string;
    data?: any;
}

export const GoogleMapsAPITester: React.FC = () => {
    const [results, setResults] = useState<TestResult[]>([]);
    const [testing, setTesting] = useState(false);

    // Test coordinates (Chicago to Milwaukee)
    const testOrigin = { lat: 41.8781, lng: -87.6298, address: 'Chicago, IL' };
    const testDestination = { lat: 43.0389, lng: -87.9065, address: 'Milwaukee, WI' };
    const testAddress = '1600 Amphitheatre Parkway, Mountain View, CA';

    const updateResult = (api: string, status: 'pending' | 'success' | 'error', message: string, data?: any) => {
        setResults(prev => {
            const existing = prev.find(r => r.api === api);
            if (existing) {
                return prev.map(r => r.api === api ? { api, status, message, data } : r);
            }
            return [...prev, { api, status, message, data }];
        });
    };

    // Test 1: Geocoding API
    const testGeocodingAPI = async () => {
        updateResult('Geocoding API', 'pending', 'Testing address to coordinates conversion...');

        try {
            const data = await geocodeAddress(testAddress);
            updateResult(
                'Geocoding API',
                'success',
                `✅ Converted "${testAddress}" to coordinates`,
                data
            );
        } catch (error: any) {
            updateResult('Geocoding API', 'error', `❌ Error: ${error.message}`);
        }
    };

    // Test 2: Distance Matrix API
    const testDistanceMatrixAPI = async () => {
        updateResult('Distance Matrix API', 'pending', 'Calculating driving distance and time...');

        try {
            const data = await getDistanceMatrix(
                { lat: testOrigin.lat, lng: testOrigin.lng },
                { lat: testDestination.lat, lng: testDestination.lng }
            );

            updateResult(
                'Distance Matrix API',
                'success',
                `✅ ${testOrigin.address} → ${testDestination.address}`,
                data
            );
        } catch (error: any) {
            updateResult('Distance Matrix API', 'error', `❌ Error: ${error.message}`);
        }
    };

    // Test 3: Directions API
    const testDirectionsAPI = async () => {
        updateResult('Directions API', 'pending', 'Getting turn-by-turn directions...');

        try {
            const data = await getDirections(
                { lat: testOrigin.lat, lng: testOrigin.lng },
                { lat: testDestination.lat, lng: testDestination.lng }
            );

            updateResult(
                'Directions API',
                'success',
                `✅ Found route with directions`,
                data
            );
        } catch (error: any) {
            updateResult('Directions API', 'error', `❌ Error: ${error.message}`);
        }
    };

    // Test 4: Roads API (Snap to Roads)
    const testRoadsAPI = async () => {
        updateResult('Roads API', 'pending', 'Snapping GPS coordinates to nearest road...');

        try {
            const path = [
                { lat: testOrigin.lat + 0.001, lng: testOrigin.lng + 0.001 },
                { lat: testDestination.lat - 0.001, lng: testDestination.lng - 0.001 }
            ];

            const data = await snapToRoads(path);

            updateResult(
                'Roads API',
                'success',
                `✅ Snapped ${data.length} GPS points to roads`,
                data
            );
        } catch (error: any) {
            updateResult('Roads API', 'error', `❌ Error: ${error.message}`);
        }
    };

    const runAllTests = async () => {
        setTesting(true);
        setResults([]);

        await testGeocodingAPI();
        await new Promise(resolve => setTimeout(resolve, 500));

        await testDistanceMatrixAPI();
        await new Promise(resolve => setTimeout(resolve, 500));

        await testDirectionsAPI();
        await new Promise(resolve => setTimeout(resolve, 500));

        await testRoadsAPI();

        setTesting(false);
    };

    const getStatusIcon = (status: 'pending' | 'success' | 'error') => {
        switch (status) {
            case 'pending':
                return <Loader className="w-5 h-5 text-blue-500 animate-spin" />;
            case 'success':
                return <CheckCircle className="w-5 h-5 text-green-500" />;
            case 'error':
                return <XCircle className="w-5 h-5 text-red-500" />;
        }
    };

    const getAPIIcon = (api: string) => {
        if (api.includes('Geocoding')) return <Search className="w-4 h-4" />;
        if (api.includes('Distance')) return <Zap className="w-4 h-4" />;
        if (api.includes('Directions')) return <Navigation className="w-4 h-4" />;
        if (api.includes('Roads')) return <Route className="w-4 h-4" />;
        return <MapPin className="w-4 h-4" />;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 p-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-8 mb-6">
                    <h1 className="text-3xl font-black text-white mb-2">Google Maps API Tester</h1>
                    <p className="text-slate-400 text-sm">
                        Testing Roads API, Distance Matrix API, Directions API, and Geocoding API
                    </p>
                    <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                        <p className="text-xs text-blue-300 font-bold mb-2">Test Route:</p>
                        <p className="text-xs text-slate-300">
                            📍 <span className="font-bold">{testOrigin.address}</span> → <span className="font-bold">{testDestination.address}</span>
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                            Address to geocode: {testAddress}
                        </p>
                    </div>
                </div>

                {/* Run Tests Button */}
                <button
                    onClick={runAllTests}
                    disabled={testing}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:from-slate-700 disabled:to-slate-700 text-white font-black py-4 px-6 rounded-2xl mb-6 transition-all shadow-lg disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {testing ? (
                        <>
                            <Loader className="w-5 h-5 animate-spin" />
                            Running Tests...
                        </>
                    ) : (
                        <>
                            <Zap className="w-5 h-5" />
                            Run All API Tests
                        </>
                    )}
                </button>

                {/* Results */}
                <div className="space-y-4">
                    {results.map((result) => (
                        <div
                            key={result.api}
                            className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 transition-all hover:border-white/20"
                        >
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-slate-800/50 rounded-xl">
                                    {getAPIIcon(result.api)}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-lg font-black text-white">{result.api}</h3>
                                        {getStatusIcon(result.status)}
                                    </div>
                                    <p className="text-sm text-slate-300 mb-3">{result.message}</p>

                                    {result.data && (
                                        <div className="bg-slate-950/50 rounded-xl p-4 border border-white/5">
                                            <pre className="text-xs text-green-400 font-mono overflow-x-auto">
                                                {JSON.stringify(result.data, null, 2)}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {results.length === 0 && !testing && (
                    <div className="bg-slate-900/30 border border-dashed border-white/10 rounded-2xl p-12 text-center">
                        <MapPin className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                        <p className="text-slate-500 font-bold">Click "Run All API Tests" to start testing</p>
                    </div>
                )}

                {/* API Status Summary */}
                {results.length > 0 && (
                    <div className="mt-6 bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-4">Summary</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                                <div className="text-2xl font-black text-green-500">
                                    {results.filter(r => r.status === 'success').length}
                                </div>
                                <div className="text-xs text-green-300 font-bold">Passed</div>
                            </div>
                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                                <div className="text-2xl font-black text-red-500">
                                    {results.filter(r => r.status === 'error').length}
                                </div>
                                <div className="text-xs text-red-300 font-bold">Failed</div>
                            </div>
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                                <div className="text-2xl font-black text-blue-500">
                                    {results.filter(r => r.status === 'pending').length}
                                </div>
                                <div className="text-xs text-blue-300 font-bold">Pending</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// Math Utilities Library
// Common constants and mathematical functions

// Constants
const PI: f32 = 3.14159265359;
const TAU: f32 = 6.28318530718;
const EPSILON: f32 = 0.000001;

// Utility functions
fn saturate(x: f32) -> f32 {
    return clamp(x, 0.0, 1.0);
}

fn saturate3(x: vec3<f32>) -> vec3<f32> {
    return clamp(x, vec3<f32>(0.0), vec3<f32>(1.0));
}

fn remap(value: f32, minIn: f32, maxIn: f32, minOut: f32, maxOut: f32) -> f32 {
    return minOut + (value - minIn) * (maxOut - minOut) / (maxIn - minIn);
}

// SDF Primitives
fn sdSphere(p: vec3<f32>, r: f32) -> f32 {
    return length(p) - r;
}

fn sdBox(p: vec3<f32>, b: vec3<f32>) -> f32 {
    let q = abs(p) - b;
    return length(max(q, vec3<f32>(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0);
}

// Randomness
fn random(st: vec2<f32>) -> f32 {
    return fract(sin(dot(st.xy, vec2<f32>(12.9898, 78.233))) * 43758.5453123);
}

fn random3(p: vec3<f32>) -> f32 {
    return fract(sin(dot(p, vec3<f32>(12.9898, 78.233, 154.321))) * 43758.5453);
}


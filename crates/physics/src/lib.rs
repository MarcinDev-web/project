use wasm_bindgen::prelude::*;
use glam::{Vec3, Quat, Mat3};
use std::collections::{HashMap, HashSet};

#[cfg(feature = "panic-hook")]
#[wasm_bindgen]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}

// --- Data Structures ---

#[wasm_bindgen]
#[derive(Clone, Copy, PartialEq)]
pub enum BodyType {
    Dynamic = 0,
    Static = 1,
    Kinematic = 2,
}

#[derive(Clone)]
pub struct RigidBody {
    pub id: u32,
    pub body_type: BodyType,
    pub position: Vec3,
    pub rotation: Quat,
    pub scale: Vec3,
    pub velocity: Vec3,
    pub angular_velocity: Vec3,
    pub mass: f32,
    pub inverse_mass: f32,
    pub linear_drag: f32,
    pub angular_drag: f32,
    pub use_gravity: bool,
    pub is_sleeping: bool,
    pub sleep_timer: f32,
    // Constraints
    pub freeze_position: [bool; 3],
    pub freeze_rotation: [bool; 3],
    // Accumulators
    pub force_accumulator: Vec3,
    pub torque_accumulator: Vec3,
}

impl RigidBody {
    pub fn new(id: u32, body_type: BodyType) -> Self {
        Self {
            id,
            body_type,
            position: Vec3::ZERO,
            rotation: Quat::IDENTITY,
            scale: Vec3::ONE,
            velocity: Vec3::ZERO,
            angular_velocity: Vec3::ZERO,
            mass: 1.0,
            inverse_mass: 1.0,
            linear_drag: 0.0,
            angular_drag: 0.0,
            use_gravity: true,
            is_sleeping: false,
            sleep_timer: 0.0,
            freeze_position: [false; 3],
            freeze_rotation: [false; 3],
            force_accumulator: Vec3::ZERO,
            torque_accumulator: Vec3::ZERO,
        }
    }

    pub fn wake_up(&mut self) {
        self.is_sleeping = false;
        self.sleep_timer = 0.0;
    }

    pub fn apply_force(&mut self, force: Vec3) {
        if self.body_type != BodyType::Dynamic { return; }
        self.force_accumulator += force;
        self.wake_up();
    }

    pub fn apply_impulse(&mut self, impulse: Vec3) {
        if self.body_type != BodyType::Dynamic { return; }
        self.velocity += impulse * self.inverse_mass;
        self.wake_up();
    }
    
    pub fn apply_torque_impulse(&mut self, impulse: Vec3) {
        if self.body_type != BodyType::Dynamic { return; }
        let inv_inertia = self.get_world_inverse_inertia_tensor();
        self.angular_velocity += inv_inertia * impulse;
        self.wake_up();
    }

    pub fn get_world_inverse_inertia_tensor(&self) -> Mat3 {
        if self.inverse_mass == 0.0 {
            return Mat3::ZERO;
        }
        // Simplified box inertia tensor
        // I = 1/12 * m * (h^2 + d^2)
        let w = self.scale.x; // Should use collider size... using scale as proxy for now
        let h = self.scale.y;
        let d = self.scale.z;
        
        let ix = 1.0 / 12.0 * self.mass * (h*h + d*d);
        let iy = 1.0 / 12.0 * self.mass * (w*w + d*d);
        let iz = 1.0 / 12.0 * self.mass * (w*w + h*h);
        
        let inv_i = Vec3::new(1.0/ix, 1.0/iy, 1.0/iz);
        let local_inv_inertia = Mat3::from_diagonal(inv_i);
        
        let rot_mat = Mat3::from_quat(self.rotation);
        rot_mat * local_inv_inertia * rot_mat.transpose()
    }
}

#[derive(Clone, Copy, PartialEq)]
pub enum ColliderShape {
    Box = 0,
    Sphere = 1,
    Capsule = 2,
}

#[derive(Clone)]
pub struct Collider {
    pub shape: ColliderShape,
    pub size: Vec3, // For Box (full extents)
    pub radius: f32, // For Sphere, Capsule
    pub height: f32, // For Capsule
    pub offset: Vec3,
    pub is_trigger: bool,
    pub friction: f32,
    pub restitution: f32,
}

#[derive(Clone)]
pub struct ContactPoint {
    pub position: Vec3,
    pub normal: Vec3,
    pub depth: f32,
}

pub struct CollisionManifold {
    pub entity_a: u32,
    pub entity_b: u32,
    pub contacts: Vec<ContactPoint>,
    pub friction: f32,
    pub restitution: f32,
}

// --- Joints ---

#[derive(Clone, Copy, PartialEq)]
pub enum JointType {
    Fixed = 0,
    Distance = 1,
    Spring = 2,
    Hinge = 3,
    BallSocket = 4,
    Slider = 5,
}

#[derive(Clone)]
pub struct Joint {
    pub id: u32,
    pub joint_type: JointType,
    pub body_a: u32,
    pub body_b: u32,
    pub local_anchor_a: Vec3,
    pub local_anchor_b: Vec3,
    // Common params
    pub breakable: bool,
    pub break_force: f32,
    pub enabled: bool,
    // Specific params
    pub distance: f32, // Distance
    pub min_dist: f32, // Distance/Slider/Spring
    pub max_dist: f32, // Distance/Slider/Spring
    pub stiffness: f32, // Spring
    pub damping: f32, // Spring/Distance
    pub axis_a: Vec3, // Hinge/Slider
    pub axis_b: Vec3, // Hinge/Slider
    pub limits_enabled: bool, // Hinge/Slider
    pub min_angle: f32, // Hinge
    pub max_angle: f32, // Hinge
    pub motor_enabled: bool, // Hinge/Slider
    pub motor_speed: f32, // Hinge/Slider
    pub max_motor_force: f32, // Hinge/Slider
}

// --- Spatial Grid ---

struct SpatialGrid {
    cell_size: f32,
    cells: HashMap<(i32, i32, i32), Vec<u32>>,
}

impl SpatialGrid {
    fn new(cell_size: f32) -> Self {
        Self {
            cell_size,
            cells: HashMap::new(),
        }
    }

    fn clear(&mut self) {
        self.cells.clear();
    }

    fn insert(&mut self, id: u32, min: Vec3, max: Vec3) {
        let min_x = (min.x / self.cell_size).floor() as i32;
        let min_y = (min.y / self.cell_size).floor() as i32;
        let min_z = (min.z / self.cell_size).floor() as i32;
        let max_x = (max.x / self.cell_size).floor() as i32;
        let max_y = (max.y / self.cell_size).floor() as i32;
        let max_z = (max.z / self.cell_size).floor() as i32;

        for x in min_x..=max_x {
            for y in min_y..=max_y {
                for z in min_z..=max_z {
                    self.cells.entry((x, y, z)).or_default().push(id);
                }
            }
        }
    }

    fn get_potential_pairs(&self) -> HashSet<(u32, u32)> {
        let mut pairs = HashSet::new();
        for entities in self.cells.values() {
            for i in 0..entities.len() {
                for j in (i + 1)..entities.len() {
                    let a = entities[i];
                    let b = entities[j];
                    if a < b {
                        pairs.insert((a, b));
                    } else {
                        pairs.insert((b, a));
                    }
                }
            }
        }
        pairs
    }
}

// --- World ---

#[wasm_bindgen]
pub struct PhysicsWorld {
    bodies: HashMap<u32, RigidBody>,
    colliders: HashMap<u32, Vec<Collider>>,
    joints: HashMap<u32, Joint>,
    gravity: Vec3,
    iterations: u32,
    
    // Spatial Grid
    grid: SpatialGrid,
    
    // Events
    event_buffer: Vec<f32>, // [id1, id2, type]
    
    // Scratch
    collisions: Vec<CollisionManifold>,
    next_joint_id: u32,
}

#[wasm_bindgen]
impl PhysicsWorld {
    #[wasm_bindgen(constructor)]
    pub fn new(gx: f32, gy: f32, gz: f32) -> Self {
        Self {
            bodies: HashMap::new(),
            colliders: HashMap::new(),
            joints: HashMap::new(),
            gravity: Vec3::new(gx, gy, gz),
            iterations: 4,
            grid: SpatialGrid::new(10.0),
            event_buffer: Vec::new(),
            collisions: Vec::new(),
            next_joint_id: 1,
        }
    }

    pub fn add_body(
        &mut self, 
        id: u32, 
        body_type: BodyType, 
        x: f32, y: f32, z: f32,
        qx: f32, qy: f32, qz: f32, qw: f32,
        mass: f32, linear_drag: f32, angular_drag: f32,
        fixed_x: bool, fixed_y: bool, fixed_z: bool,
    ) {
        let mut body = RigidBody::new(id, body_type);
        body.position = Vec3::new(x, y, z);
        body.rotation = Quat::from_xyzw(qx, qy, qz, qw);
        body.mass = mass;
        body.inverse_mass = if body_type == BodyType::Dynamic && mass > 0.0 { 1.0 / mass } else { 0.0 };
        body.linear_drag = linear_drag;
        body.angular_drag = angular_drag;
        body.freeze_position = [fixed_x, fixed_y, fixed_z];
        self.bodies.insert(id, body);
    }

    pub fn remove_body(&mut self, id: u32) {
        self.bodies.remove(&id);
        self.colliders.remove(&id);
        // Remove connected joints
        self.joints.retain(|_, j| j.body_a != id && j.body_b != id);
    }

    pub fn add_collider(
        &mut self,
        body_id: u32,
        shape: u8,
        sx: f32, sy: f32, sz: f32,
        ox: f32, oy: f32, oz: f32,
        is_trigger: bool,
        friction: f32,
        restitution: f32
    ) {
        let shape_enum = match shape {
            0 => ColliderShape::Box,
            1 => ColliderShape::Sphere,
            2 => ColliderShape::Capsule,
            _ => ColliderShape::Box,
        };

        let collider = Collider {
            shape: shape_enum,
            size: Vec3::new(sx, sy, sz),
            radius: sx,
            height: sy,
            offset: Vec3::new(ox, oy, oz),
            is_trigger,
            friction,
            restitution,
        };

        self.colliders.entry(body_id).or_default().push(collider);
    }

    pub fn add_joint(
        &mut self,
        joint_type: u8,
        body_a: u32, body_b: u32,
        ax: f32, ay: f32, az: f32, // anchor A
        bx: f32, by: f32, bz: f32, // anchor B
        // Params packed into array for simplicity in FFI, or just many args
        distance: f32, min_dist: f32, max_dist: f32,
        stiffness: f32, damping: f32,
        axis_ax: f32, axis_ay: f32, axis_az: f32,
        axis_bx: f32, axis_by: f32, axis_bz: f32,
    ) -> u32 {
        let jt = match joint_type {
            0 => JointType::Fixed,
            1 => JointType::Distance,
            2 => JointType::Spring,
            3 => JointType::Hinge,
            4 => JointType::BallSocket,
            5 => JointType::Slider,
            _ => JointType::Fixed,
        };
        
        let id = self.next_joint_id;
        self.next_joint_id += 1;
        
        let joint = Joint {
            id,
            joint_type: jt,
            body_a,
            body_b,
            local_anchor_a: Vec3::new(ax, ay, az),
            local_anchor_b: Vec3::new(bx, by, bz),
            breakable: false,
            break_force: f32::MAX,
            enabled: true,
            distance,
            min_dist,
            max_dist,
            stiffness,
            damping,
            axis_a: Vec3::new(axis_ax, axis_ay, axis_az),
            axis_b: Vec3::new(axis_bx, axis_by, axis_bz),
            limits_enabled: false,
            min_angle: 0.0,
            max_angle: 0.0,
            motor_enabled: false,
            motor_speed: 0.0,
            max_motor_force: 0.0,
        };
        
        self.joints.insert(id, joint);
        id
    }
    
    pub fn remove_joint(&mut self, id: u32) {
        self.joints.remove(&id);
    }

    pub fn set_transform(&mut self, id: u32, x: f32, y: f32, z: f32, qx: f32, qy: f32, qz: f32, qw: f32) {
        if let Some(body) = self.bodies.get_mut(&id) {
            body.position = Vec3::new(x, y, z);
            body.rotation = Quat::from_xyzw(qx, qy, qz, qw);
            body.wake_up();
        }
    }
    
    pub fn set_scale(&mut self, id: u32, x: f32, y: f32, z: f32) {
        if let Some(body) = self.bodies.get_mut(&id) {
            body.scale = Vec3::new(x, y, z);
        }
    }
    
    pub fn set_kinematic_target(&mut self, id: u32, x: f32, y: f32, z: f32, qx: f32, qy: f32, qz: f32, qw: f32) {
        if let Some(body) = self.bodies.get_mut(&id) {
            if body.body_type == BodyType::Kinematic {
                body.position = Vec3::new(x, y, z);
                body.rotation = Quat::from_xyzw(qx, qy, qz, qw);
            }
        }
    }

    pub fn step(&mut self, dt: f32) {
        self.integrate_forces(dt);
        self.update_broadphase();
        self.detect_collisions();
        
        for _ in 0..self.iterations {
            self.resolve_collisions();
            self.solve_joints(dt);
        }
        
        self.integrate_velocities(dt);
    }
    
    pub fn get_sync_buffer_ptr(&self) -> *const f32 {
        std::ptr::null()
    }
    
    pub fn sync_states(&mut self) -> Vec<f32> {
         let mut buffer = Vec::new();
         for body in self.bodies.values() {
             if body.body_type == BodyType::Dynamic && !body.is_sleeping {
                 buffer.push(body.id as f32);
                 buffer.push(body.position.x);
                 buffer.push(body.position.y);
                 buffer.push(body.position.z);
                 buffer.push(body.rotation.x);
                 buffer.push(body.rotation.y);
                 buffer.push(body.rotation.z);
                 buffer.push(body.rotation.w);
             }
         }
         buffer
    }
    
    pub fn get_event_buffer(&mut self) -> Vec<f32> {
        let buf = self.event_buffer.clone();
        self.event_buffer.clear();
        buf
    }
}

impl PhysicsWorld {
    fn integrate_forces(&mut self, dt: f32) {
        for body in self.bodies.values_mut() {
            if body.body_type != BodyType::Dynamic || body.is_sleeping {
                continue;
            }

            let inv_mass = body.inverse_mass;
            if inv_mass == 0.0 { continue; }

            // Gravity
            if body.use_gravity {
                body.velocity += self.gravity * dt;
            }

            // Forces
            let accel = body.force_accumulator * inv_mass;
            body.velocity += accel * dt;
            
            // Linear Drag
            let drag = (1.0 - body.linear_drag * dt).max(0.0);
            body.velocity *= drag;

            // Torques
            let inv_inertia = body.get_world_inverse_inertia_tensor();
            let angular_accel = inv_inertia * body.torque_accumulator;
            body.angular_velocity += angular_accel * dt;
            
            // Angular Drag
            let ang_drag = (1.0 - body.angular_drag * dt).max(0.0);
            body.angular_velocity *= ang_drag;

            // Clear accumulators
            body.force_accumulator = Vec3::ZERO;
            body.torque_accumulator = Vec3::ZERO;
        }
    }

    fn integrate_velocities(&mut self, dt: f32) {
        for body in self.bodies.values_mut() {
            if body.body_type != BodyType::Dynamic || body.is_sleeping {
                continue;
            }
            
            if !body.freeze_position[0] { body.position.x += body.velocity.x * dt; }
            if !body.freeze_position[1] { body.position.y += body.velocity.y * dt; }
            if !body.freeze_position[2] { body.position.z += body.velocity.z * dt; }

            // Angular velocity -> Rotation
            let omega = body.angular_velocity;
            let speed_sq = omega.length_squared();
            if speed_sq > 0.000001 {
                let speed = speed_sq.sqrt();
                let axis = omega / speed;
                let angle = speed * dt;
                
                if !body.freeze_rotation[0] && !body.freeze_rotation[1] && !body.freeze_rotation[2] {
                    let dq = Quat::from_axis_angle(axis, angle);
                    body.rotation = (dq * body.rotation).normalize();
                }
            }
        }
    }

    fn update_broadphase(&mut self) {
        self.grid.clear();
        for (id, body) in &self.bodies {
            if let Some(cols) = self.colliders.get(id) {
                for col in cols {
                    // Compute AABB
                    let center = body.position + body.rotation * (col.offset * body.scale);
                    let extent = match col.shape {
                        ColliderShape::Box => {
                            let rot_mat = Mat3::from_quat(body.rotation);
                            let half = col.size * body.scale * 0.5;
                            Vec3::new(
                                half.x * rot_mat.x_axis.abs().x + half.y * rot_mat.y_axis.abs().x + half.z * rot_mat.z_axis.abs().x,
                                half.x * rot_mat.x_axis.abs().y + half.y * rot_mat.y_axis.abs().y + half.z * rot_mat.z_axis.abs().y,
                                half.x * rot_mat.x_axis.abs().z + half.y * rot_mat.y_axis.abs().z + half.z * rot_mat.z_axis.abs().z,
                            )
                        },
                        ColliderShape::Sphere => {
                            let r = col.radius * body.scale.max_element();
                            Vec3::splat(r)
                        },
                        ColliderShape::Capsule => {
                            let r = col.radius * body.scale.max_element();
                            let h = col.height * body.scale.y * 0.5;
                            let max_dim = r.max(h);
                            Vec3::splat(max_dim) 
                        }
                    };
                    
                    let min = center - extent;
                    let max = center + extent;
                    self.grid.insert(*id, min, max);
                }
            }
        }
    }

    fn detect_collisions(&mut self) {
        self.collisions.clear();
        let potential_pairs = self.grid.get_potential_pairs();
        
        for (id_a, id_b) in potential_pairs {
            let body_a = &self.bodies[&id_a];
            let body_b = &self.bodies[&id_b];

            if body_a.body_type != BodyType::Dynamic && body_b.body_type != BodyType::Dynamic {
                continue;
            }
            if body_a.is_sleeping && body_b.is_sleeping {
                continue;
            }

            if let (Some(cols_a), Some(cols_b)) = (self.colliders.get(&id_a), self.colliders.get(&id_b)) {
                for col_a in cols_a {
                    for col_b in cols_b {
                        if let Some(contact) = detect_collision(body_a, col_a, body_b, col_b) {
                            self.collisions.push(CollisionManifold {
                                entity_a: id_a,
                                entity_b: id_b,
                                contacts: vec![contact.clone()],
                                friction: (col_a.friction + col_b.friction) * 0.5,
                                restitution: col_a.restitution.min(col_b.restitution),
                            });
                            
                            self.event_buffer.push(id_a as f32);
                            self.event_buffer.push(id_b as f32);
                            self.event_buffer.push(1.0); // Started
                            
                            self.event_buffer.push(contact.normal.x);
                            self.event_buffer.push(contact.normal.y);
                            self.event_buffer.push(contact.normal.z);
                            self.event_buffer.push(contact.depth);
                            self.event_buffer.push(contact.position.x);
                            self.event_buffer.push(contact.position.y);
                            self.event_buffer.push(contact.position.z);
                        }
                    }
                }
            }
        }
    }

    fn resolve_collisions(&mut self) {
        let collisions = std::mem::take(&mut self.collisions);
        for manifold in &collisions {
            let id_a = manifold.entity_a;
            let id_b = manifold.entity_b;
            
            let (body_a_params, body_b_params) = self.get_pair_mut(id_a, id_b);
            
            if let (Some(ba), Some(bb)) = (body_a_params, body_b_params) {
                for contact in &manifold.contacts {
                    resolve_contact(ba, bb, contact, manifold.friction, manifold.restitution);
                }
            }
        }
        self.collisions = collisions;
    }
    
    fn solve_joints(&mut self, dt: f32) {
        // Clone IDs to avoid borrow checker issues during iteration
        let joint_ids: Vec<u32> = self.joints.keys().cloned().collect();
        
        for joint_id in joint_ids {
            // We need to access joint and both bodies mutably.
            // Since joint is in self.joints and bodies in self.bodies, we can split borrows?
            // But we are iterating.
            // Workaround: Get joint info first, then access bodies.
            
            let joint = if let Some(j) = self.joints.get(&joint_id) {
                j.clone()
            } else {
                continue;
            };
            
            if !joint.enabled { continue; }
            
            let (body_a_params, body_b_params) = self.get_pair_mut(joint.body_a, joint.body_b);
            if let (Some(ba), Some(bb)) = (body_a_params, body_b_params) {
                solve_joint(&joint, ba, bb, dt);
            }
        }
    }
    
    fn get_pair_mut(&mut self, id_a: u32, id_b: u32) -> (Option<&mut RigidBody>, Option<&mut RigidBody>) {
        if id_a == id_b { return (None, None); }
        let ptr_a = self.bodies.get_mut(&id_a).map(|r| r as *mut RigidBody);
        let ptr_b = self.bodies.get_mut(&id_b).map(|r| r as *mut RigidBody);
        
        unsafe {
            match (ptr_a, ptr_b) {
                (Some(a), Some(b)) => (Some(&mut *a), Some(&mut *b)),
                _ => (None, None)
            }
        }
    }
}

// --- Narrow Phase & Solver ---

struct Obb {
    center: Vec3,
    axes: [Vec3; 3],
    half_sizes: Vec3,
}

fn get_obb(body: &RigidBody, col: &Collider) -> Obb {
    let center = body.position + body.rotation * (col.offset * body.scale);
    let rot_mat = Mat3::from_quat(body.rotation);
    let axes = [rot_mat.x_axis.normalize(), rot_mat.y_axis.normalize(), rot_mat.z_axis.normalize()];
    let half_sizes = (col.size * body.scale).abs() * 0.5;
    Obb { center, axes, half_sizes }
}

fn detect_collision(body_a: &RigidBody, col_a: &Collider, body_b: &RigidBody, col_b: &Collider) -> Option<ContactPoint> {
    match (col_a.shape, col_b.shape) {
        (ColliderShape::Sphere, ColliderShape::Sphere) => {
            let pos_a = body_a.position + body_a.rotation * (col_a.offset * body_a.scale);
            let pos_b = body_b.position + body_b.rotation * (col_b.offset * body_b.scale);
            let ra = col_a.radius * body_a.scale.max_element();
            let rb = col_b.radius * body_b.scale.max_element();
            let delta = pos_b - pos_a;
            let dist_sq = delta.length_squared();
            let r_sum = ra + rb;
            
            if dist_sq < r_sum * r_sum {
                let dist = dist_sq.sqrt();
                let normal = if dist > 0.0001 { delta / dist } else { Vec3::Y };
                let depth = r_sum - dist;
                let position = pos_a + normal * ra;
                Some(ContactPoint { position, normal, depth })
            } else {
                None
            }
        },
        (ColliderShape::Box, ColliderShape::Box) => {
            let obb_a = get_obb(body_a, col_a);
            let obb_b = get_obb(body_b, col_b);
            
            let mut min_pen = f32::MAX;
            let mut best_axis = Vec3::ZERO;
            
            let mut axes = Vec::with_capacity(15);
            axes.extend_from_slice(&obb_a.axes);
            axes.extend_from_slice(&obb_b.axes);
            
            for i in 0..3 {
                for j in 0..3 {
                    let cross = obb_a.axes[i].cross(obb_b.axes[j]);
                    if cross.length_squared() > 0.001 {
                        axes.push(cross.normalize());
                    }
                }
            }
            
            for axis in axes {
                let p_a = project_obb(&obb_a, axis);
                let p_b = project_obb(&obb_b, axis);
                
                let overlap = (p_a.1.min(p_b.1) - p_a.0.max(p_b.0)).max(0.0);
                if overlap == 0.0 {
                    return None;
                }
                
                if overlap < min_pen {
                    min_pen = overlap;
                    best_axis = axis;
                }
            }
            
            let dir = obb_b.center - obb_a.center;
            if best_axis.dot(dir) < 0.0 {
                best_axis = -best_axis;
            }
            
            let position = obb_a.center + best_axis * (obb_a.half_sizes.x); 
            
            Some(ContactPoint { position, normal: best_axis, depth: min_pen })
        },
        _ => None 
    }
}

fn project_obb(obb: &Obb, axis: Vec3) -> (f32, f32) {
    let c = obb.center.dot(axis);
    let e = obb.half_sizes.x * obb.axes[0].dot(axis).abs() +
            obb.half_sizes.y * obb.axes[1].dot(axis).abs() +
            obb.half_sizes.z * obb.axes[2].dot(axis).abs();
    (c - e, c + e)
}

fn resolve_contact(a: &mut RigidBody, b: &mut RigidBody, contact: &ContactPoint, friction: f32, restitution: f32) {
    let total_inv_mass = a.inverse_mass + b.inverse_mass;
    if total_inv_mass <= 0.0 { return; }
    
    let correction = contact.normal * (contact.depth / total_inv_mass * 0.5);
    if a.body_type == BodyType::Dynamic { a.position -= correction * a.inverse_mass; }
    if b.body_type == BodyType::Dynamic { b.position += correction * b.inverse_mass; }
    
    let ra = contact.position - a.position;
    let rb = contact.position - b.position;
    
    let va = a.velocity + a.angular_velocity.cross(ra);
    let vb = b.velocity + b.angular_velocity.cross(rb);
    let rel_vel = vb - va;
    
    let vel_along_normal = rel_vel.dot(contact.normal);
    if vel_along_normal > 0.0 { return; }
    
    let inv_ia = a.get_world_inverse_inertia_tensor();
    let inv_ib = b.get_world_inverse_inertia_tensor();
    
    let ra_cross_n = ra.cross(contact.normal);
    let rb_cross_n = rb.cross(contact.normal);
    
    let inv_mass_sum = total_inv_mass + 
                       ra_cross_n.dot(inv_ia * ra_cross_n) + 
                       rb_cross_n.dot(inv_ib * rb_cross_n);
                       
    let j = -(1.0 + restitution) * vel_along_normal / inv_mass_sum;
    let impulse = contact.normal * j;
    
    if a.body_type == BodyType::Dynamic {
        a.velocity -= impulse * a.inverse_mass;
        a.angular_velocity -= inv_ia * ra.cross(impulse);
    }
    if b.body_type == BodyType::Dynamic {
        b.velocity += impulse * b.inverse_mass;
        b.angular_velocity += inv_ib * rb.cross(impulse);
    }
    
    let t = rel_vel - contact.normal * vel_along_normal;
    if t.length_squared() > 0.0001 {
        let tangent = t.normalize();
        let jt = -rel_vel.dot(tangent) / inv_mass_sum;
        let jt = jt.clamp(-j * friction, j * friction);
        let friction_impulse = tangent * jt;
        
        if a.body_type == BodyType::Dynamic {
            a.velocity -= friction_impulse * a.inverse_mass;
            a.angular_velocity -= inv_ia * ra.cross(friction_impulse);
        }
        if b.body_type == BodyType::Dynamic {
            b.velocity += friction_impulse * b.inverse_mass;
            b.angular_velocity += inv_ib * rb.cross(friction_impulse);
        }
    }
}

fn solve_joint(joint: &Joint, a: &mut RigidBody, b: &mut RigidBody, dt: f32) {
    let world_anchor_a = a.position + a.rotation * joint.local_anchor_a;
    let world_anchor_b = b.position + b.rotation * joint.local_anchor_b;
    
    match joint.joint_type {
        JointType::Fixed => {
            let delta = world_anchor_b - world_anchor_a;
            let dist = delta.length();
            if dist > 0.0001 {
                let normal = delta / dist;
                let impulse_mag = dist * 0.5 / dt; 
                let impulse = normal * impulse_mag;
                
                if a.body_type == BodyType::Dynamic {
                    a.velocity += impulse * a.inverse_mass;
                }
                if b.body_type == BodyType::Dynamic {
                    b.velocity -= impulse * b.inverse_mass;
                }
            }
        },
        JointType::Distance => {
            let delta = world_anchor_b - world_anchor_a;
            let dist = delta.length();
            if dist > 0.0001 {
                let normal = delta / dist;
                let err = dist - joint.distance;
                // Simple positional correction
                let correction = normal * (err * 0.5);
                if a.body_type == BodyType::Dynamic {
                    a.position += correction * a.inverse_mass;
                }
                if b.body_type == BodyType::Dynamic {
                    b.position -= correction * b.inverse_mass;
                }
            }
        },
        JointType::Spring => {
            let delta = world_anchor_b - world_anchor_a;
            let dist = delta.length();
            let normal = if dist > 0.0001 { delta / dist } else { Vec3::ZERO };
            let displacement = dist - joint.distance;
            
            // Spring force
            let force = normal * (displacement * joint.stiffness);
            
            // Damping
            let rel_vel = b.velocity - a.velocity;
            let damping_force = rel_vel * joint.damping;
            
            let total_force = force + damping_force;
            
            if a.body_type == BodyType::Dynamic {
                a.apply_force(total_force);
            }
            if b.body_type == BodyType::Dynamic {
                b.apply_force(-total_force);
            }
        },
        _ => {} // Placeholder for other joints
    }
}

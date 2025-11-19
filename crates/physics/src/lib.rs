use rapier3d::prelude::*;
use wasm_bindgen::prelude::*;
use std::cell::RefCell;
use std::rc::Rc;
use rapier3d::na::{UnitQuaternion, Quaternion};

#[cfg(feature = "panic-hook")]
#[wasm_bindgen]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}

struct MyEventHandler {
    collision_events: Rc<RefCell<Vec<(u32, u32, bool)>>>,
    trigger_events: Rc<RefCell<Vec<(u32, u32, bool)>>>,
    handle_to_id: Rc<RefCell<std::collections::HashMap<RigidBodyHandle, u32>>>,
}

// Implement Send + Sync for MyEventHandler wrapper to satisfy trait bounds.
// Since we are in WASM (single threaded), this is safe.
unsafe impl Send for MyEventHandler {}
unsafe impl Sync for MyEventHandler {}

impl EventHandler for MyEventHandler {
    fn handle_collision_event(
        &self,
        _bodies: &RigidBodySet,
        _colliders: &ColliderSet,
        event: CollisionEvent,
        _contact_pair: Option<&ContactPair>,
    ) {
        match event {
            CollisionEvent::Started(h1, h2, _flags) => {
                if let (Some(c1), Some(c2)) = (_colliders.get(h1), _colliders.get(h2)) {
                    if let (Some(b1), Some(b2)) = (c1.parent(), c2.parent()) {
                        let map = self.handle_to_id.borrow();
                        if let (Some(id1), Some(id2)) = (map.get(&b1), map.get(&b2)) {
                            self.collision_events.borrow_mut().push((*id1, *id2, true));
                        }
                    }
                }
            }
            CollisionEvent::Stopped(h1, h2, _flags) => {
                if let (Some(c1), Some(c2)) = (_colliders.get(h1), _colliders.get(h2)) {
                    if let (Some(b1), Some(b2)) = (c1.parent(), c2.parent()) {
                        let map = self.handle_to_id.borrow();
                        if let (Some(id1), Some(id2)) = (map.get(&b1), map.get(&b2)) {
                            self.collision_events.borrow_mut().push((*id1, *id2, false));
                        }
                    }
                }
            }
        }
    }

    fn handle_contact_force_event(
        &self,
        _dt: f32,
        _bodies: &RigidBodySet,
        _colliders: &ColliderSet,
        _contact_pair: &ContactPair,
        _total_force_magnitude: f32,
    ) {
        // Not used
    }
}

#[wasm_bindgen]
pub struct PhysicsWorld {
    rigid_body_set: RigidBodySet,
    collider_set: ColliderSet,
    gravity: Vector<f32>,
    integration_parameters: IntegrationParameters,
    physics_pipeline: PhysicsPipeline,
    island_manager: IslandManager,
    broad_phase: BroadPhase,
    narrow_phase: NarrowPhase,
    impulse_joint_set: ImpulseJointSet,
    multibody_joint_set: MultibodyJointSet,
    ccd_solver: CCDSolver,
    
    body_handles: Vec<Option<RigidBodyHandle>>,
    free_body_ids: Vec<u32>,
    
    collider_handles: Vec<Option<ColliderHandle>>,
    free_collider_ids: Vec<u32>,

    sync_buffer: Vec<f32>,
    
    // Event handling
    collision_events: Rc<RefCell<Vec<(u32, u32, bool)>>>,
    trigger_events: Rc<RefCell<Vec<(u32, u32, bool)>>>,
    handle_to_id: Rc<RefCell<std::collections::HashMap<RigidBodyHandle, u32>>>,
    event_handler: MyEventHandler,
    
    // Buffer for events to return to JS
    event_buffer: Vec<f32>,
    trigger_event_buffer: Vec<f32>,
}

#[wasm_bindgen]
impl PhysicsWorld {
    #[wasm_bindgen(constructor)]
    pub fn new(gravity_x: f32, gravity_y: f32, gravity_z: f32) -> PhysicsWorld {
        let collision_events = Rc::new(RefCell::new(Vec::new()));
        let trigger_events = Rc::new(RefCell::new(Vec::new()));
        let handle_to_id = Rc::new(RefCell::new(std::collections::HashMap::new()));
        
        let event_handler = MyEventHandler {
            collision_events: collision_events.clone(),
            trigger_events: trigger_events.clone(),
            handle_to_id: handle_to_id.clone(),
        };

        PhysicsWorld {
            rigid_body_set: RigidBodySet::new(),
            collider_set: ColliderSet::new(),
            gravity: vector![gravity_x, gravity_y, gravity_z],
            integration_parameters: IntegrationParameters::default(),
            physics_pipeline: PhysicsPipeline::new(),
            island_manager: IslandManager::new(),
            broad_phase: BroadPhase::new(),
            narrow_phase: NarrowPhase::new(),
            impulse_joint_set: ImpulseJointSet::new(),
            multibody_joint_set: MultibodyJointSet::new(),
            ccd_solver: CCDSolver::new(),
            body_handles: Vec::new(),
            free_body_ids: Vec::new(),
            collider_handles: Vec::new(),
            free_collider_ids: Vec::new(),
            sync_buffer: Vec::new(),
            collision_events,
            trigger_events,
            handle_to_id,
            event_handler,
            event_buffer: Vec::new(),
            trigger_event_buffer: Vec::new(),
        }
    }

    pub fn set_gravity(&mut self, x: f32, y: f32, z: f32) {
        self.gravity = vector![x, y, z];
    }

    pub fn step(&mut self, dt: f32) {
        self.integration_parameters.dt = dt;
        
        self.physics_pipeline.step(
            &self.gravity,
            &self.integration_parameters,
            &mut self.island_manager,
            &mut self.broad_phase,
            &mut self.narrow_phase,
            &mut self.rigid_body_set,
            &mut self.collider_set,
            &mut self.impulse_joint_set,
            &mut self.multibody_joint_set,
            &mut self.ccd_solver,
            None,
            &(),
            &self.event_handler,
        );
    }

    pub fn add_rigid_body(
        &mut self,
        body_type: u8,
        x: f32,
        y: f32,
        z: f32,
        rx: f32,
        ry: f32,
        rz: f32,
        rw: f32,
        lin_damp: f32,
        ang_damp: f32,
    ) -> u32 {
        let rb_type = match body_type {
            0 => RigidBodyType::Dynamic,
            1 => RigidBodyType::Fixed,
            2 => RigidBodyType::KinematicPositionBased,
            3 => RigidBodyType::KinematicVelocityBased,
            _ => RigidBodyType::Dynamic,
        };

        // Rapier 3D uses AngVector (Vector3) for rotation in `rotation()` method?
        // Wait, `rotation()` sets the rotation.
        // In 3D, rotation is a UnitQuaternion.
        // The error says: expected `Matrix<f32, Const<3>, Const<1>, ...>`, found `Unit<Quaternion<f32>>`
        // This means `rotation()` expects a rotation vector (axis-angle) or similar?
        // Let's check docs.
        // `RigidBodyBuilder::rotation` takes `AngVector<Real>`.
        // In 3D, `AngVector` is `Vector3` (rotation vector).
        // But we have a quaternion.
        // We should use `RigidBodyBuilder::position` which takes an `Isometry`.
        // Or convert quaternion to rotation vector? No, that's lossy/ambiguous.
        // Wait, `RigidBodyBuilder` usually has `rotation` taking a rotation matrix or quaternion?
        // In Rapier 0.18, `rotation` takes `AngVector` (scaled axis of rotation).
        // To set rotation via quaternion, we should use `position` with an `Isometry`.
        // `Isometry::from_parts(Translation::from(vector![x, y, z]), rotation)`
        
        let rotation = UnitQuaternion::from_quaternion(Quaternion::new(rw, rx, ry, rz));
        let translation = vector![x, y, z].into();
        let isometry = Isometry::from_parts(translation, rotation);

        let rigid_body = RigidBodyBuilder::new(rb_type)
            .position(isometry)
            .linear_damping(lin_damp)
            .angular_damping(ang_damp)
            .build();
        
        let handle = self.rigid_body_set.insert(rigid_body);
        
        let id = if let Some(id) = self.free_body_ids.pop() {
            self.body_handles[id as usize] = Some(handle);
            id
        } else {
            let id = self.body_handles.len() as u32;
            self.body_handles.push(Some(handle));
            id
        };
        
        self.handle_to_id.borrow_mut().insert(handle, id);
        id
    }

    pub fn remove_rigid_body(&mut self, id: u32) {
        if id as usize >= self.body_handles.len() {
            return;
        }
        if let Some(handle) = self.body_handles[id as usize] {
            self.handle_to_id.borrow_mut().remove(&handle);
            self.rigid_body_set.remove(
                handle,
                &mut self.island_manager,
                &mut self.collider_set,
                &mut self.impulse_joint_set,
                &mut self.multibody_joint_set,
                true,
            );
            self.body_handles[id as usize] = None;
            self.free_body_ids.push(id);
        }
    }

    pub fn add_collider(
        &mut self,
        body_id: u32,
        shape_type: u8, // 0: Cuboid, 1: Sphere, 2: Capsule, 3: Cylinder
        args: &[f32],
        friction: f32,
        restitution: f32,
        density: f32,
        is_sensor: bool,
    ) -> u32 {
        if body_id as usize >= self.body_handles.len() {
            return u32::MAX;
        }
        let body_handle = match self.body_handles[body_id as usize] {
            Some(h) => h,
            None => return u32::MAX,
        };

        let shape = match shape_type {
            0 => SharedShape::cuboid(args[0], args[1], args[2]),
            1 => SharedShape::ball(args[0]), // SharedShape::sphere -> ball
            2 => SharedShape::capsule(point![0.0, -args[1], 0.0], point![0.0, args[1], 0.0], args[0]), // capsule(a, b, radius)
            3 => SharedShape::cylinder(args[1], args[0]),
            _ => SharedShape::cuboid(1.0, 1.0, 1.0),
        };

        let collider = ColliderBuilder::new(shape)
            .friction(friction)
            .restitution(restitution)
            .density(density)
            .sensor(is_sensor)
            .active_events(ActiveEvents::COLLISION_EVENTS) // Enable collision events
            .build();

        let handle = self.collider_set.insert_with_parent(collider, body_handle, &mut self.rigid_body_set);

        if let Some(id) = self.free_collider_ids.pop() {
            self.collider_handles[id as usize] = Some(handle);
            id
        } else {
            let id = self.collider_handles.len() as u32;
            self.collider_handles.push(Some(handle));
            id
        }
    }

    pub fn remove_collider(&mut self, id: u32) {
        if id as usize >= self.collider_handles.len() {
            return;
        }
        if let Some(handle) = self.collider_handles[id as usize] {
            self.collider_set.remove(
                handle,
                &mut self.island_manager,
                &mut self.rigid_body_set,
                true,
            );
            self.collider_handles[id as usize] = None;
            self.free_collider_ids.push(id);
        }
    }
    
    pub fn get_body_position(&self, id: u32) -> Vec<f32> {
        if let Some(Some(handle)) = self.body_handles.get(id as usize) {
            if let Some(body) = self.rigid_body_set.get(*handle) {
                let t = body.translation();
                return vec![t.x, t.y, t.z];
            }
        }
        vec![0.0, 0.0, 0.0]
    }

    pub fn get_body_rotation(&self, id: u32) -> Vec<f32> {
        if let Some(Some(handle)) = self.body_handles.get(id as usize) {
            if let Some(body) = self.rigid_body_set.get(*handle) {
                let r = body.rotation();
                return vec![r.i, r.j, r.k, r.w];
            }
        }
        vec![0.0, 0.0, 0.0, 1.0]
    }
    
    pub fn set_kinematic_translation(&mut self, id: u32, x: f32, y: f32, z: f32) {
        if let Some(Some(handle)) = self.body_handles.get(id as usize) {
            if let Some(body) = self.rigid_body_set.get_mut(*handle) {
                if body.is_kinematic() {
                    body.set_next_kinematic_translation(vector![x, y, z]);
                }
            }
        }
    }

    pub fn set_kinematic_rotation(&mut self, id: u32, x: f32, y: f32, z: f32, w: f32) {
        if let Some(Some(handle)) = self.body_handles.get(id as usize) {
            if let Some(body) = self.rigid_body_set.get_mut(*handle) {
                if body.is_kinematic() {
                    let rotation = UnitQuaternion::from_quaternion(Quaternion::new(w, x, y, z));
                    body.set_next_kinematic_rotation(rotation);
                }
            }
        }
    }
    
    pub fn get_sync_buffer_ptr(&self) -> *const f32 {
        self.sync_buffer.as_ptr()
    }

    pub fn sync_states(&mut self) -> usize {
        let _stride = 8; // id, x, y, z, qx, qy, qz, qw
        self.sync_buffer.clear();
        
        let mut count = 0;
        
        for (id, handle_opt) in self.body_handles.iter().enumerate() {
            if let Some(handle) = handle_opt {
                if let Some(body) = self.rigid_body_set.get(*handle) {
                    if body.is_dynamic() && !body.is_sleeping() {
                        let t = body.translation();
                        let r = body.rotation();
                        
                        self.sync_buffer.push(id as f32);
                        self.sync_buffer.push(t.x);
                        self.sync_buffer.push(t.y);
                        self.sync_buffer.push(t.z);
                        self.sync_buffer.push(r.i);
                        self.sync_buffer.push(r.j);
                        self.sync_buffer.push(r.k);
                        self.sync_buffer.push(r.w);
                        
                        count += 1;
                    }
                }
            }
        }
        count
    }
    
    pub fn get_event_buffer_ptr(&self) -> *const f32 {
        self.event_buffer.as_ptr()
    }
    
    pub fn consume_events(&mut self) -> usize {
        let mut events = self.collision_events.borrow_mut();
        self.event_buffer.clear();
        let count = events.len();
        
        for (id1, id2, started) in events.iter() {
            self.event_buffer.push(*id1 as f32);
            self.event_buffer.push(*id2 as f32);
            self.event_buffer.push(if *started { 1.0 } else { 0.0 });
        }
        
        events.clear();
        count
    }

    pub fn get_trigger_event_buffer_ptr(&self) -> *const f32 {
        self.trigger_event_buffer.as_ptr()
    }

    pub fn consume_trigger_events(&mut self) -> usize {
        let mut events = self.trigger_events.borrow_mut();
        self.trigger_event_buffer.clear();
        let count = events.len();
        
        for (id1, id2, started) in events.iter() {
            self.trigger_event_buffer.push(*id1 as f32);
            self.trigger_event_buffer.push(*id2 as f32);
            self.trigger_event_buffer.push(if *started { 1.0 } else { 0.0 });
        }
        
        events.clear();
        count
    }
}

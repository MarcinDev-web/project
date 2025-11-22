use crate::signal::Signal;
use crate::vm::LogicExecutionContext;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NodeType {
    // Flow
    Trigger = 0,
    Delay = 1,
    Timer = 2,
    Counter = 3,
    
    // Logic
    And = 10,
    Or = 11,
    Not = 12,
    Xor = 13,
    
    // Data
    Variable = 20,
    ConstNumber = 22,
    ConstString = 23,
    ConstBool = 24,
    
    // Math
    Add = 30,
    Sub = 31,
    Mul = 32,
    Div = 33,
    Greater = 34,
    Less = 35,
    Equal = 36,
    
    Unknown = 255,
}

impl From<u16> for NodeType {
    fn from(v: u16) -> Self {
        match v {
            0 => NodeType::Trigger,
            1 => NodeType::Delay,
            2 => NodeType::Timer,
            3 => NodeType::Counter,
            10 => NodeType::And,
            11 => NodeType::Or,
            12 => NodeType::Not,
            13 => NodeType::Xor,
            20 => NodeType::Variable,
            22 => NodeType::ConstNumber,
            23 => NodeType::ConstString,
            24 => NodeType::ConstBool,
            30 => NodeType::Add,
            31 => NodeType::Sub,
            32 => NodeType::Mul,
            33 => NodeType::Div,
            34 => NodeType::Greater,
            35 => NodeType::Less,
            36 => NodeType::Equal,
            _ => NodeType::Unknown,
        }
    }
}

pub trait NodeBehavior {
    fn on_init(&mut self) {}
    fn on_signal(&mut self, port_id: u8, signal: &Signal, ctx: &mut LogicExecutionContext) -> Option<Vec<(u8, Signal)>>;
    fn on_update(&mut self, _dt: f32, _ctx: &mut LogicExecutionContext) -> Option<Vec<(u8, Signal)>> { None }
}

pub struct LogicNode {
    pub id: u32,
    pub type_id: NodeType,
    pub behavior: Box<dyn NodeBehavior>,
}


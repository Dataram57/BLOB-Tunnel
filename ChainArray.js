//ChainArray class
//element requirements:
//.chainFront - reference to next neigbour element
//.chainBack - reference to last neighbour element
//element is not wrapped into another object (danger for parameters collision)
//element is not checked if it is a null (danger for counting)(should alwyas be removed from the chain, before becoming a null)

//Methods of switching chains:
//METHOD 1: FIRST CHAIN (FIRST CHAIN ASSIGN)
//METHOD 2: CHAIN SWAP (REMOVE FROM THE OLD CHAIN => MOVE TO THE NEW CHAIN)
//METHOD 3: NO CHAIN (SAFELY REMOVE FROM ALL CHAINS)

class ChainArray {
    constructor(){
        this.head = null;
        this.length = 0;
    }

    //adding new element
    //obj should not be in the array
    Add(obj){
        //check error
        if(!obj)
            return -1;
        //set front(to target the old head) and back
        obj.chainFront = this.head;
        obj.chainBack = null;
        if(this.head)
            //inform the old head
            this.head.chainBack = obj;
        //change the head of the chain
        this.head = obj;
        //return length
        return ++this.length;
    }

    //removing existing element
    //assumes that 
    Remove(obj){
        //check error
        if(!obj)
            return -1;
        //check if head
        if(obj.chainBack){
            //obj is not a head
            obj.chainBack.chainFront = obj.chainFront;
            //check if not last
            if(obj.chainFront)
                //obj is not last
                obj.chainFront.chainBack = obj.chainBack;
        }else{
            //obj is a head
            //check if not last
            if(obj.chainFront){
                //obj is not last
                this.head = obj.chainFront;
                //(skip reading old pointer's data)
                this.head.chainBack = null;
            }else
                //sussy case, check if he is the head
                //if(this.head == obj)
                //obj is the head and the last, meaning that the count is equal to 1
                this.head = null;
                //else
                    //obj is not in the array
                    //do nothing
                    //return this.length;
        }
        //return length
        return --this.length;
    }

    //Count
    //returns count
    Count(){
        let i = 0;
        let obj = this.head;
        while(obj){
            obj = obj.chainFront;
            i++;
        }
        return i;
    }

    //Count with length correction
    //returns if there was a split in the chain.
    CountCorrect(){
        const d = this.length - this.Count();
        this.length -= d;
        return d != 0;
    }

    //move to top, send back, send front etc...
}
module.exports = ChainArray;